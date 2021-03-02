const fs = require("fs");
const ics = require("ics");
const yargs = require("yargs");
const fetch = require("node-fetch");


// 命令行参数
const argv = yargs
  .option('id', {
    describe: '你的学号',
    alias: 'i'
  })
  .option('day', {
    default: '2021-03-01',
    describe: '开学第一天',
    alias: 'd'
  })
  .option('notice', {
    default: 0,
    describe: '提前通知时间（分钟），0 为不提醒',
    alias: 'n'
  })
  .demand(['i'])
  .help('h')
  .usage('Usage: $0 [options]')
  .alias('h', 'help')
  .argv

argv.notice = {
  all: argv.notice,
  m: argv.notice % 60,
  h: parseInt(argv.notice / 60),
}

// 学期开始时间
const semesterBegin = new Date(`${argv.day} 00:00:00`);
// 初始化第一周时间
const weekday = new Array(7).fill(semesterBegin.getTime()).map((el, index) => {
  return el + index * 86400000;
});
// 设置课程开始时间
const begin = [28800000, 36900000, 50400000, 58500000, 68400000, 74700000];
// 设置一周时长
const week = 86400000 * 7;
// 课程数组
const classTable = [];

// 生成课表
generate();

// 生成课表函数
function generate() {
  fetch("https://cyxbsmobile.redrock.team/api/kebiao", {
    method: "post",
    body: "stu_num=" + argv.id,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  }).then(res => res.json())
    .then(res => {
      if (res.success) {
        for (let i of res.data) {
          addCourse(i);
        }
        // 处理成ics文件
        const { error, value } = ics.createEvents(classTable);
        if (error) {
          console.log("生成 ics 文件失败");
          return;
        }
        console.log("生成 ics 文件成功");
        fs.writeFileSync(`${__dirname}/${argv.id}.ics`, value);
      }
      else {
        console.log("获取课表失败");
        return;
      }
    })
}

function addCourse(courseInfo) {
  let duration = { hours: 1, minutes: 40 };
  if (courseInfo.rawWeek.indexOf("3节连上") !== -1) {
    duration = { hours: 3 };
  } else if (courseInfo.rawWeek.indexOf("4节连上") !== -1) {
    duration = { hours: 3, minutes: 55 };
  }

  // 处理课程每周
  for (let index of courseInfo.week) {
    let info = {
      title: courseInfo.course,
      location: courseInfo.classroom,
      description: `${courseInfo.teacher} ${courseInfo.type} ${courseInfo.rawWeek}`,
      start: formatDate(weekday[courseInfo.hash_day] + week * (index - 1) + begin[(courseInfo.begin_lesson - 1) / 2]),
      duration: duration,
      status: "TENTATIVE",
      categories: ["课程表", courseInfo.course],
      busyStatus: "BUSY",
      calName: "课程表",
    }
    // 提前通知，通过文件导入生效，通过链接导入不生效，默认不通知
    if (argv.notice.all) {
      info.alarms = [
        {
          action: "display",
          trigger: { hours: argv.notice.h, minutes: argv.notice.m, before: true },
        }
      ]
    }
    classTable.push(info);
  }
}

function formatDate(time) {
  let date = new Date(time);
  return [
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
  ];
}

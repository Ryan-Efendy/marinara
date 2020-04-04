'use strict';

var fs = require('fs');

fs.readFile('/Users/ryanefendy/Downloads/test2.json', 'utf8', (err, data) => {
    if (err) throw err;
    let { pomodoros } = JSON.parse(data);
    // console.log(pomodoros);

    let yearly = {
        "2018": {},
        "2019": {},
        "2020": {}
    };
    let twentyeighteen = new Date(2018,0,0,0,0);
    let twentynineteen = new Date(2019,0,0,0,0);
    let twentytwenty = new Date(2020,0,0,0,0);
    let twentytwentyone = new Date(2021,0,0,0,0)

    for (var date in pomodoros) {
        if (pomodoros.hasOwnProperty(date)) {
            if (isBetweenDates(twentyeighteen, twentynineteen, date)) {
                yearly["2018"][date] = pomodoros[date];
                continue;
            }
            
            if (isBetweenDates(twentynineteen, twentytwenty, date)) {
                yearly["2019"][date] = pomodoros[date];
                continue;
            }

            if (isBetweenDates(twentytwenty, twentytwentyone, date)) {
                yearly["2020"][date] = pomodoros[date];
                continue;
            }
        }
    }

    // console.log(yearly);
    fs.writeFile('personal_yearly.json', JSON.stringify(yearly), err => { if(err) throw err });
});

let isBetweenDates = (from, to, curr) => curr > from && curr < to;

// let getDaysInMonth = () => {
//     let days = [];
//     let d = new Date();
//     d.setDate(1);
//     d.setHours(0);
//     d.setMinutes(0);
//     d.setSeconds(0);
//     d.setMilliseconds(0);
//     let nextMonth = d.getMonth()+1;

//     while (d.getMonth() < nextMonth) {
//         days.push(+d);
//         d.setDate(d.getDate() + 1);
//     }
//     return days;
// }

// let getDaysInWeek = () => {
//     let days = [];
//     let d = new Date();
//     d.setDate(d.getDate() - d.getDay());
//     d.setHours(0);
//     d.setMinutes(0);
//     d.setSeconds(0);
//     d.setMilliseconds(0);

//     for (let i=0; i<7; i++) {
//         days.push(+d);
//         d.setDate(d.getDate() + 1);
//     }

//     return days;
// }

// let days = getDaysInMonth();
// let days = getDaysInWeek();

// console.log(days);
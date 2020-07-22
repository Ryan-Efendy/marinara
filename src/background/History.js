import Chrome from '../Chrome';
import StorageManager from './StorageManager';
import RLE from './RLE';
import Mutex from '../Mutex';
import M from '../Messages';
import * as firebase from 'firebase/app';
import 'firebase/database';


class History {
  constructor() {
    this.storage = new StorageManager(new HistorySchema(), Chrome.storage.local);
    this.mutex = new Mutex();
    this.ref = firebase.database().ref('pomodoros');
    this.pomodoros = {};
  }

  async all() {
    return await this.storage.get();
  }

  async clear() {
    await this.storage.set(this.storage.schema.default);
  }

  /** 
  * get pomodoros obj from firebase
  * @return {ReturnValueDataTypeHere} pomodoros obj {2018: {date: 1, date: 2...}, 2019: {...}, 2020: {...}}
  */
  async getPomodoros() {
    return new Promise((resolve, reject) => {
      this.ref.on("value", (snapshot) => {
        resolve(snapshot.val());
      }, (error) => {
        console.log("Error: " + error.code);
        reject(error);
      });
    });
  }

  async merge2(history) {
    return await this.mutex.exclusive(async () => {
      await this.storage.set(history);
      let total = 0;
      for (let year in history.pomodoros) {
        if (history.pomodoros.hasOwnProperty(year)) {
          if (!Object.keys(history.pomodoros[year]).length) continue;
          total += Object.values(history.pomodoros[year]).reduce((acc, val) => acc + val)
        }
      }
      return total;
    });
  }
  /** 
  * invoke when a pomodoro completes
  * @return {ReturnValueDataTypeHere} Brief description of the returning value here.
  */
  async addPomodoro2() {
    await this.mutex.exclusive(async () => {
      // let local = await this.storage.get();
      if (this.pomodoros === undefined || this.pomodoros === null) {
        this.pomodoros = await this.getPomodoros();
      }
      
      let today = new Date().setHours(0, 0, 0, 0);

      var twentyTwentyRef = firebase.database().ref("pomodoros/2020");
      // todo: remove hardcode
      if (today in this.pomodoros['2020']) {
        this.pomodoros['2020'][today] += 1;
      } else {
        this.pomodoros['2020'][today] = 1;
      }

      twentyTwentyRef.update(this.pomodoros['2020']);
      // await this.storage.set(local);
      // return this.countSince2(pomodoros['2020'], History.today);
      return this.countSinceToday(this.pomodoros['2020']);
    });
  }

  async stats2() {
    return this.mutex.exclusive(async () => {
      this.pomodoros = await this.getPomodoros();
      // await this.storage.get('pomodoros');
      // if (pomodoros === undefined || pomodoros === null) {
      //   pomodoros = {};
      // }

      let total = 0;
      for (var year in this.pomodoros) {
        if (this.pomodoros.hasOwnProperty(year)) {
          if (!Object.keys(this.pomodoros[year]).length) continue;
          total += Object.values(this.pomodoros[year]).reduce((acc, val) => acc + val)
        }
      }

      return {
        pomodoros: this.pomodoros,
        day: this.countSinceToday(this.pomodoros['2020']),
        week: this.countSinceThisWeek(this.pomodoros['2020']),
        month: this.countSinceThisMonth(this.pomodoros['2020']),
        // period: this.countSince2(pomodoros['2020'], new Date(since)),
        total: total
      };
    });
  }

  /**
 * Returns the sum of all numbers passed to the function.
 * @param {...number} num - A positive or negative number.
 */
  async countToday() {
    return this.mutex.exclusive(async () => {
      if (!this.pomodoros) {
        // pomodoros = (await this.storage.get('pomodoros')).pomodoros;
        this.pomodoros = await this.getPomodoros();

        if (Object.keys(this.pomodoros['2020']).length === 0) {
          return 0;
        }
      }

      // return this.countSince(pomodoros, History.today);
      return this.countSinceToday(this.pomodoros['2020']);
    });
  }

  /**
   * Returns how many pomodoros completed from date (i.e. today)
   * @param {Object} pomodoros - "pomodoros": { "2018": { "1545379200000": 7, "2019": { "1545379200000": 7}}
   * @param {Date} date - beginning of today's date 
   */
  countSinceToday(pomodoros) {
    if (!pomodoros) return 0;

    let today = new Date();
    today.setHours(0);
    today.setMinutes(0);
    today.setSeconds(0);
    today.setMilliseconds(0);

    return +today in pomodoros ? pomodoros[+today] : 0;
  }

  countSinceThisWeek(pomodoros) {
    if (!pomodoros) return 0;

    let daysInWeek = [];
    let d = new Date();
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0);
    d.setMinutes(0);
    d.setSeconds(0);
    d.setMilliseconds(0);

    for (let i = 0; i < 7; i++) {
      daysInWeek.push(+d);
      d.setDate(d.getDate() + 1);
    }

    let total = 0;
    daysInWeek.forEach(day => {
      total += !isNaN(pomodoros[day]) ? parseInt(pomodoros[day]) : 0;
    });

    return total;
  }

  countSinceThisMonth(pomodoros) {
    if (!pomodoros) return 0;

    let daysInMonth = [];
    let d = new Date();
    d.setDate(1);
    d.setHours(0);
    d.setMinutes(0);
    d.setSeconds(0);
    d.setMilliseconds(0);
    let nextMonth = d.getMonth() + 1;

    while (d.getMonth() < nextMonth) {
      daysInMonth.push(+d);
      d.setDate(d.getDate() + 1);
    }

    let total = 0;
    daysInMonth.forEach(day => {
      total += !isNaN(pomodoros[day]) ? parseInt(pomodoros[day]) : 0;
    });

    return total;
  }

  static timestamp(date) {
    return Math.floor(+date / 1000 / 60);
  }

  static date(timestamp) {
    return new Date(timestamp * 60 * 1000);
  }
}

class HistorySchema {
  get version() {
    return 1;
  }

  get default() {
    return {
      pomodoros: {},
      // durations: [],
      // timezones: [],
      version: this.version
    };
  }
}

function decompress(historyRLE) {
  if (!historyRLE) {
    throw new Error(M.missing_pomodoro_data);
  }

  let {
    pomodoros,
    durations: durationsRLE,
    timezones: timezonesRLE
  } = historyRLE;

  if (!pomodoros) {
    throw new Error(M.missing_pomodoro_data);
  }

  if (!durationsRLE) {
    throw new Error(M.missing_duration_data);
  }

  if (!Array.isArray(durationsRLE)) {
    throw new Error(M.invalid_duration_data);
  }

  if (!timezonesRLE) {
    throw new Error(M.missing_timezone_data);
  }

  if (!Array.isArray(timezonesRLE)) {
    throw new Error(M.missing_timezone_data);
  }

  const durations = RLE.decompress(durationsRLE);
  const timezones = RLE.decompress(timezonesRLE);

  if (pomodoros.length !== durations.length) {
    throw new Error(M.mismatched_pomodoro_duration_data);
  }

  if (pomodoros.length !== timezones.length) {
    throw new Error(M.mismatched_pomodoro_timezone_data);
  }

  for (let i = 0; i < pomodoros.length; i++) {
    if (!Number.isInteger(pomodoros[i])) {
      throw new Error(M.invalid_pomodoro_data);
    }

    if (!Number.isInteger(durations[i])) {
      throw new Error(M.invalid_duration_data);
    }

    if (!Number.isInteger(timezones[i])) {
      throw new Error(M.invalid_timezone_data);
    }
  }

  return {
    ...historyRLE,
    pomodoros,
    durations,
    timezones
  };
}

function compress(history) {
  if (!history) {
    throw new Error(M.missing_pomodoro_data);
  }

  if (!history.durations) {
    throw new Error(M.missing_duration_data);
  }

  if (!Array.isArray(history.durations)) {
    throw new Error(M.invalid_duration_data);
  }

  if (!history.timezones) {
    throw new Error(M.missing_timezone_data);
  }

  if (!Array.isArray(history.timezones)) {
    throw new Error(M.invalid_timezone_data);
  }

  return {
    ...history,
    durations: RLE.compress(history.durations),
    timezones: RLE.compress(history.timezones)
  };
}

function merge(existing, importing) {
  let {
    pomodoros: existingPomodoros,
    durations: existingDurations,
    timezones: existingTimezones
  } = existing;

  let {
    pomodoros: importingPomodoros,
    durations: importingDurations,
    timezones: importingTimezones
  } = importing;

  let pomodoros = [...existingPomodoros];
  let durations = [...existingDurations];
  let timezones = [...existingTimezones];

  let count = 0;
  for (let i = 0; i < importingPomodoros.length; i++) {
    let timestamp = importingPomodoros[i];
    let index = search(pomodoros, timestamp);

    if (pomodoros[index] === timestamp) {
      // Pomodoros with the same timestamp are considered
      // identical and are excluded when being imported.
      continue;
    }

    count++;
    pomodoros.splice(index, 0, timestamp);
    durations.splice(index, 0, importingDurations[i]);
    timezones.splice(index, 0, importingTimezones[i]);
  }

  return {
    count,
    merged: {
      ...existing,
      pomodoros,
      durations,
      timezones
    }
  };
}

// Returns the index in arr for which all elements at or after the index are
// at least min. If all elements are less than min, this returns arr.length.
function search(arr, min, lo = null, hi = null) {
  lo = lo || 0;
  hi = hi || (arr.length - 1);

  while (lo <= hi) {
    let mid = Math.floor((lo + hi) / 2);
    if (arr[mid] >= min) {
      hi = mid - 1;
    } else if (arr[mid] < min) {
      lo = mid + 1;
    }
  }

  return Math.min(lo, arr.length);
}

export {
  History,
  merge
};
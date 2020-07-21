import Chrome from '../Chrome';
import StorageManager from './StorageManager';
import RLE from './RLE';
import Mutex from '../Mutex';
import M from '../Messages';

class History
{
  constructor() {
    this.storage = new StorageManager(new HistorySchema(), Chrome.storage.sync);
    this.mutex = new Mutex();
  }

  async all() {
    return await this.storage.get();
  }

  async clear() {
    await this.storage.set(this.storage.schema.default);
  }

  // async merge(history) {
  //   return await this.mutex.exclusive(async () => {
  //     let existing = decompress(await this.storage.get());
  //     let importing = decompress(history);
  //     let { count, merged } = merge(existing, importing);
  //     await this.storage.set(compress(merged));
  //     return count;
  //   });
  // }

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

  // async toCSV() {
  //   let {
  //     pomodoros,
  //     durations,
  //     timezones
  //   } = decompress(await this.storage.get());

  //   const escape = value => {
  //     if (value.indexOf(',') < 0) {
  //       return value;
  //     }

  //     return '"' + value.replace(/"/g, '""') + '"';
  //   };

  //   const row = values => values.map(v => escape(v.toString())).join(',') + '\n';

  //   let csv = row([
  //     M.end_iso_8601,
  //     M.end_date,
  //     M.end_time,
  //     M.end_timestamp,
  //     M.end_timezone,
  //     M.duration_seconds
  //   ]);

  //   for (let i = 0; i < pomodoros.length; i++) {
  //     let [timestamp, timezone] = [pomodoros[i] * 60, -timezones[i]];
  //     let time = moment.unix(timestamp).utcOffset(timezone, true);
  //     csv += row([
  //       time.toISOString(true),
  //       time.format('YYYY-MM-DD'),
  //       time.format('HH:mm:ss'),
  //       timestamp,
  //       timezone,
  //       durations[i]
  //     ]);
  //   }

  //   return csv;
  // }

  async addPomodoro(duration, when = null) {
    await this.mutex.exclusive(async () => {
      let local = await this.storage.get();

      when = when || new Date();
      let timestamp = History.timestamp(when);

      let i = local.pomodoros.length - 1;
      while (i >= 0 && local.pomodoros[i] > timestamp) {
        --i;
      }

      let timezone = when.getTimezoneOffset();

      if (i >= local.pomodoros.length - 1) {
        // Timestamps *should* be monotonically increasing, so we should
        // always be able to quickly append new values.
        RLE.append(local.durations, duration);
        RLE.append(local.timezones, timezone);
        local.pomodoros.push(timestamp);
      } else {
        // If there is a timestamp inversion for some reason, insert values
        // at the correct sorted position.
        let durations = RLE.decompress(local.durations);
        durations.splice(i + 1, 0, duration);
        local.durations = RLE.compress(durations);

        let timezones = RLE.decompress(local.timezones);
        timezones.splice(i + 1, 0, timezone);
        local.timezones = RLE.compress(timezones);

        local.pomodoros.splice(i + 1, 0, timestamp);
      }

      await this.storage.set(local);

      return this.countSince(local.pomodoros, History.today);
    });
  }

  /**
   * look at countSince2
   */
  async addPomodoro2() {
    await this.mutex.exclusive(async () => {
      let local = await this.storage.get();
      let today = new Date().setHours(0,0,0,0);
      
      // todo: remove hardcode
      if (today in local.pomodoros['2020']) {
        local.pomodoros['2020'][today] += 1;
      } else {
        local.pomodoros['2020'][today] = 1;
      }

      await this.storage.set(local);
      // return this.countSince2(local.pomodoros['2020'], History.today);
      return this.countSinceToday(local.pomodoros['2020']);
  });

    
  }

  // async stats(since) {
  //   return this.mutex.exclusive(async () => {
  //     let { pomodoros } = await this.storage.get('pomodoros');

  //     let total = pomodoros.length;
  //     let delta = total === 0 ? 0 : (new Date() - History.date(pomodoros[0]));
  //     let dayCount = Math.max(delta / 1000 / 60 / 60 / 24, 1);
  //     let weekCount = Math.max(dayCount / 7, 1);
  //     let monthCount = Math.max(dayCount / (365.25 / 12), 1);

  //     return {
  //       day: this.countSince(pomodoros, History.today),
  //       dayAverage: total / dayCount,
  //       week: this.countSince(pomodoros, History.thisWeek),
  //       weekAverage: total / weekCount,
  //       month: this.countSince(pomodoros, History.thisMonth),
  //       monthAverage: total / monthCount,
  //       period: this.countSince(pomodoros, new Date(since)),
  //       total: total,
  //       daily: this.dailyGroups(pomodoros, since),
  //       pomodoros: pomodoros ? pomodoros.map(p => +History.date(p)) : pomodoros
  //     };
  //   });
  // }

  async stats2() {
    return this.mutex.exclusive(async () => {
      let { pomodoros } = await this.storage.get('pomodoros');
      if (pomodoros === undefined || pomodoros === null) {
        pomodoros = {};
      }

      let total = 0;
      for (var year in pomodoros) {
        if (pomodoros.hasOwnProperty(year)) {
          if (!Object.keys(pomodoros[year]).length) continue;
          total += Object.values(pomodoros[year]).reduce((acc, val) => acc + val)
        }
      }
      
      return {
        pomodoros,
        day: this.countSinceToday(pomodoros['2020']),
        week: this.countSinceThisWeek(pomodoros['2020']),
        month: this.countSinceThisMonth(pomodoros['2020']),
        // period: this.countSince2(pomodoros['2020'], new Date(since)),
        total: total
      };
    });
  }

  /**
 * Returns the sum of all numbers passed to the function.
 * @param {...number} num - A positive or negative number.
 */
  async countToday(pomodoros = null) {
    return this.mutex.exclusive(async () => {
      if (!pomodoros) {
        pomodoros = (await this.storage.get('pomodoros')).pomodoros;
        if (Object.keys(pomodoros['2020']).length === 0) {
          return 0;
        }
      }

      // return this.countSince(pomodoros, History.today);
      return this.countSinceToday(pomodoros['2020']);
    });
  }

  // countSince(pomodoros, date) {
  //   let timestamp = History.timestamp(date);
  //   let index = search(pomodoros, timestamp);
  //   return pomodoros.length - index;
  // }

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

    for (let i=0; i<7; i++) {
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
    let nextMonth = d.getMonth()+1;

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

  // dailyGroups(pomodoros, since) {
  //   let start = new Date(since);

  //   let daily = {};
  //   let base = 0;
  //   let date = History.today;
  //   while (date >= start) {
  //     let countSince = this.countSince(pomodoros, date);
  //     let count = countSince - base;
  //     if (count > 0) {
  //       daily[+date] = count;
  //       base = countSince;
  //     }
  //     date.setDate(date.getDate() - 1);
  //   }

  //   return daily;
  // }

  static timestamp(date) {
    return Math.floor(+date / 1000 / 60);
  }

  static date(timestamp) {
    return new Date(timestamp * 60 * 1000);
  }

  // /**
  //  * Returns the beginning of today's date as Date object
  //  */
  // static get today() {
  //   let today = new Date();
  //   today.setHours(0);
  //   today.setMinutes(0);
  //   today.setSeconds(0);
  //   today.setMilliseconds(0);
  //   return today;
  // }

  // /**
  //  * Returns the beginning of the week (starting on Sunday)
  //  */
  // static get thisWeek() {
  //   let week = new Date();
  //   week.setDate(week.getDate() - week.getDay());
  //   week.setHours(0);
  //   week.setMinutes(0);
  //   week.setSeconds(0);
  //   week.setMilliseconds(0);
  //   return week;
  // }

  // /**
  //  * Returns the beginning of the month
  //  */
  // static get thisMonth() {
  //   let month = new Date();
  //   month.setDate(1);
  //   month.setHours(0);
  //   month.setMinutes(0);
  //   month.setSeconds(0);
  //   month.setMilliseconds(0);
  //   return month;
  // }
}

class HistorySchema
{
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
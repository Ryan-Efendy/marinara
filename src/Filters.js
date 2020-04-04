import M from './Messages';
import { formatter } from './LocaleFormat';

function integer(value) {
  return value.toLocaleString();
}

function float(value, digits) {
  return value.toLocaleString(navigator.language, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function strftime(value, format) {
  return formatter(format)(value);
}

function pomodoroCount(pomodoros) {
  if (!pomodoros) return M.pomodoro_count_zero;
  
  if (Number.isInteger(pomodoros)) {
    if (pomodoros === 0) {
      return M.pomodoro_count_zero;
    } else if (pomodoros === 1) {
      return M.pomodoro_count_one;
    } else {
      return M.pomodoro_count_many(pomodoros.toLocaleString());
    }
  }

  if (!Object.keys(pomodoros).length) return M.pomodoro_count_zero;

  if (isNaN(pomodoros)) {
    let count = Object.values(pomodoros).reduce((acc, val) => acc + val)
    if (count === 0) {
      return M.pomodoro_count_zero;
    } else if (count === 1) {
      return M.pomodoro_count_one;
    } else {
      return M.pomodoro_count_many(count.toLocaleString());
    }
  }
  
  return M.pomodoro_count_zero;
}

function mmss(seconds) {
  let minutes = Math.floor(seconds / 60);
  if (minutes < 10) {
    minutes = '0' + minutes;
  }
  seconds = Math.floor(seconds % 60);
  if (seconds < 10) {
    seconds = '0' + seconds;
  }
  return `${minutes}:${seconds}`;
}

function clamp(value, lo, hi) {
  if (value <= lo) {
    return lo;
  }

  if (value >= hi) {
    return hi;
  }

  return value;
}

export {
  float,
  integer,
  strftime,
  pomodoroCount,
  mmss,
  clamp
};
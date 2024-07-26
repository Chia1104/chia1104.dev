import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

const TIMEZONE = "Asia/Taipei";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault(TIMEZONE);

export const getToday = () => {
  return dayjs().format("YYYY-MM-DD");
};

/** Get Time, format `12:00:00`  */
export const getShortTime = (date: Date) => {
  return Intl.DateTimeFormat("zh-TW", {
    timeStyle: "medium",
    hour12: false,
  }).format(date);
};

export const getShortDate = (date: Date) => {
  return dayjs(date).format("YYYY-MM-DD");
};
/** 2-12-22, 21:31:42 */
export const getShortDateTime = (date: Date) => {
  return Intl.DateTimeFormat("zh-TW", {
    dateStyle: "short",
    timeStyle: "medium",
    hour12: false,
  })
    .format(date)
    .replace(/\//g, "-");
};
/** YYYY-MM-DD_HH:mm:ss  */
export const getMediumDateTime = (date: Date) => {
  return dayjs(date).format("YYYY-MM-DD_HH:mm:ss");
};

export const getTodayEarly = (today: Date | string | number) =>
  dayjs(today).set("hour", 0).set("minute", 0).set("millisecond", 0).toDate();
export const getTodayLate = (today: Date | string | number) =>
  dayjs(today)
    .set("hour", 23)
    .set("minute", 59)
    .set("millisecond", 999)
    .toDate();

export const setDay = (today: Date | string | number, day: number) =>
  dayjs(today)
    .set("day", day)
    .set("hour", 0)
    .set("millisecond", 0)
    .set("minute", 0)
    .toDate();

export const getWeekStart = (today: Date | string | number) =>
  dayjs(today)
    .set("day", 0)
    .set("hour", 0)
    .set("millisecond", 0)
    .set("minute", 0)
    .toDate();

export const getMonday = (today: Date | string | number) =>
  dayjs(today)
    .set("day", 1)
    .set("hour", 0)
    .set("minute", 0)
    .set("millisecond", 0)
    .toDate();

export const getTuesday = (today: Date | string | number) =>
  dayjs(today)
    .set("day", 2)
    .set("hour", 0)
    .set("minute", 0)
    .set("millisecond", 0)
    .toDate();

export const getWednesday = (today: Date | string | number) =>
  dayjs(today)
    .set("day", 3)
    .set("hour", 0)
    .set("minute", 0)
    .set("millisecond", 0)
    .toDate();

export const getThursday = (today: Date | string | number) =>
  dayjs(today)
    .set("day", 4)
    .set("hour", 0)
    .set("minute", 0)
    .set("millisecond", 0)
    .toDate();

export const getFriday = (today: Date | string | number) =>
  dayjs(today)
    .set("day", 5)
    .set("hour", 0)
    .set("minute", 0)
    .set("millisecond", 0)
    .toDate();

export const getWeekEnd = (today: Date | string | number) =>
  dayjs(today)
    .set("day", 6)
    .set("hour", 23)
    .set("millisecond", 999)
    .set("minute", 59)
    .toDate();

export const getMonthStart = (today: Date | string | number) =>
  dayjs(today)
    .set("date", 1)
    .set("hour", 0)
    .set("minute", 0)
    .set("millisecond", 0)
    .toDate();
export const getMonthEnd = (today: Date | string | number) =>
  dayjs(today)
    .set("date", dayjs(today).daysInMonth())
    .set("hour", 23)
    .set("minute", 59)
    .set("millisecond", 999)
    .toDate();

export function getMonthLength(month: number, year: number) {
  return new Date(year, month, 0).getDate();
}

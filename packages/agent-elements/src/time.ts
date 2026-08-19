const timeOnly = new Intl.DateTimeFormat(undefined, { timeStyle: "short" });
const dateAndTime = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});
const full = new Intl.DateTimeFormat(undefined, {
  dateStyle: "full",
  timeStyle: "medium",
});

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/** Time of day for today's messages, date and time for older ones. */
export const formatMessageTime = (at: number, now = new Date()): string => {
  const date = new Date(at);
  return sameDay(date, now) ? timeOnly.format(date) : dateAndTime.format(date);
};

export const formatMessageTimeFull = (at: number): string =>
  full.format(new Date(at));

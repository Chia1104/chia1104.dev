/**
 * Formatters are created on first use, not at import: a module-level `Intl.DateTimeFormat`
 * would freeze the locale and time zone of whichever runtime evaluated the module first.
 */
const formatters = new Map<string, Intl.DateTimeFormat>();

const formatter = (key: string, options: Intl.DateTimeFormatOptions) => {
  let instance = formatters.get(key);
  if (!instance) {
    instance = new Intl.DateTimeFormat(undefined, options);
    formatters.set(key, instance);
  }
  return instance;
};

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/** Time of day for today's messages, date and time for older ones. */
export const formatMessageTime = (at: number, now = new Date()): string => {
  const date = new Date(at);
  return sameDay(date, now)
    ? formatter("time", { timeStyle: "short" }).format(date)
    : formatter("dateTime", { dateStyle: "medium", timeStyle: "short" }).format(
        date
      );
};

export const formatMessageTimeFull = (at: number): string =>
  formatter("full", { dateStyle: "full", timeStyle: "medium" }).format(
    new Date(at)
  );

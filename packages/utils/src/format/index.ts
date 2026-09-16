export function truncateMiddle(
  inputString: string,
  maxLength: number,
  opts?: {
    ellipsis?: string;
    frontLength?: number;
    backLength?: number;
  }
) {
  if (inputString.length <= maxLength) {
    return inputString;
  }

  const ellipsis = opts?.ellipsis ?? "...";
  const frontLength =
    opts?.frontLength ?? Math.ceil((maxLength - ellipsis.length) / 2);
  const backLength =
    opts?.backLength ?? Math.floor((maxLength - ellipsis.length) / 2);

  const frontPart = inputString.substring(0, frontLength);
  const backPart = inputString.substring(inputString.length - backLength);

  return frontPart + ellipsis + backPart;
}

/** `text` cut to `max` characters, the last one an ellipsis when anything was cut. */
export const truncateEnd = (text: string, max: number): string => {
  if (max <= 0) return "";
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
};

/** `text` with its whitespace collapsed to single spaces, then cut to `max` characters. */
export const oneLine = (text: string, max: number): string =>
  truncateEnd(text.replace(/\s+/g, " ").trim(), max);

/** A timestamp in the browser's locale and zone: medium date, short time. */
export const formatDateTime = (value: Date | string | number): string =>
  new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

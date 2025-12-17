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

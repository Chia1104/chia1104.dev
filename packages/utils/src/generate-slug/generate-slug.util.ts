import { getToday } from "../day/day.util";
import crypto from "node:crypto";

const generateSlug = (title: string) => {
  return getToday() +
    "-" +
    title
      .toLowerCase()
      .replace(/[^\w ]+/g, "")
      .replace(/ +/g, "-") +
    "-" +
    typeof crypto.randomBytes ===
    "function"
    ? crypto.randomBytes(4).toString("hex")
    : crypto.randomUUID();
};

export default generateSlug;

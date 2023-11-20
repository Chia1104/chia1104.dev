import { getToday } from "../day/day.util";
import crypto from "crypto";

const generateSlug = (title: string) => {
  return (
    getToday() +
    "-" +
    title
      .toLowerCase()
      .replace(/[^\w ]+/g, "")
      .replace(/ +/g, "-") +
    "-" +
    crypto.randomBytes(4).toString("hex")
  );
};

export default generateSlug;

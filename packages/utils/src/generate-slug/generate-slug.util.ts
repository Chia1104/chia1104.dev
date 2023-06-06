import { getToday } from "../day/day.util";

const generateSlug = (title: string) => {
  return (
    getToday() +
    "-" +
    title
      .toLowerCase()
      .replace(/[^\w ]+/g, "")
      .replace(/ +/g, "-")
  );
};

export default generateSlug;

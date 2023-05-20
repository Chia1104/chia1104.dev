import { getToday } from "utils";

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

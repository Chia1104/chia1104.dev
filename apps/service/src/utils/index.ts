export const splitString = (str?: string | null): string[] => {
  if (!str) {
    return [];
  }
  return str.split(",").map((item) => item.trim());
};

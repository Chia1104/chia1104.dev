export const isUrl = (
  url: any,
  allowedProtocols: string[] = ["http", "https"]
): boolean => {
  try {
    new URL(url);
    return allowedProtocols.includes(url.split(":")[0]);
  } catch (e) {
    return false;
  }
};

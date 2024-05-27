export const isUrl = (
  url: any,
  allowedProtocols: string[] = ["http", "https"]
): boolean => {
  try {
    const _url = new URL(url as string);
    return allowedProtocols.includes(_url.toString().split(":")[0]);
  } catch (e) {
    return false;
  }
};

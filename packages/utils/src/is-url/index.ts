export const isUrl = (
  url: any,
  allowedProtocols: string[] = ["http", "https"]
): boolean => {
  try {
    const _url = new URL(url as string).toString().split(":")[0];
    if (!_url) {
      return false;
    }
    return allowedProtocols.includes(_url);
  } catch (e) {
    console.error(e);
    return false;
  }
};

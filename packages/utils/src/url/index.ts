/** The host of `url` without a leading `www.`; the input itself when it does not parse. */
export const hostnameOf = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

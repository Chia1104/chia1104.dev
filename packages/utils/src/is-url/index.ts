import { z } from "zod";

export const urlSchema = z.union([z.string().url(), z.instanceof(URL)]);

interface Options<TStrict extends boolean = false> {
  allowedProtocols?: string[];
  /**
   * force check is URL instance
   */
  strict?: TStrict;
}

export const isUrl = <T = unknown, TStrict extends boolean = false>(
  url: T,
  options?: Options<TStrict>
) => {
  const { allowedProtocols = ["http", "https"], strict } = options || {};
  try {
    const parsed = urlSchema.parse(url);
    if (strict && parsed instanceof URL) {
      const urlProtocol = parsed.protocol.replace(":", "");
      return allowedProtocols.includes(urlProtocol);
    }
    const _url = new URL(parsed).protocol.replace(":", "");
    return allowedProtocols.includes(_url);
    // eslint-disable-next-line
  } catch (error) {
    return false;
  }
};

export const isURLInstance = (url: unknown): url is URL => {
  return isUrl(url, { strict: true });
};

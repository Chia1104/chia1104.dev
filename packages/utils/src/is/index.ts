import * as z from "zod";

export const urlSchema = z.compile(z.union([z.url(), z.instanceof(URL)]));

interface IsUrlOptions<TStrict extends boolean = false> {
  allowedProtocols?: string[];
  /** Requires a `URL` instance, not a string. */
  strict?: TStrict;
}

export const isUrl = <T = unknown, TStrict extends boolean = false>(
  url: T,
  options?: IsUrlOptions<TStrict>
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
  } catch {
    return false;
  }
};

export const isURLInstance = <TValue>(url: TValue): url is TValue & URL => {
  return isUrl(url, { strict: true });
};

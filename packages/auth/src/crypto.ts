/** `bytes` of CSPRNG output, base64url without padding. */
export const randomToken = (bytes = 32) =>
  Buffer.from(crypto.getRandomValues(new Uint8Array(bytes))).toString(
    "base64url"
  );

/** SHA-256, base64url without padding. */
export const sha256 = async (value: string) =>
  Buffer.from(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  ).toString("base64url");

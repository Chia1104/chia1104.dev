import { createHmac } from "node:crypto";

export const encodeInput = (input: string, hashSecret: string) => {
  const hmac = createHmac("sha256", hashSecret);
  hmac.update(JSON.stringify({ input }));
  return hmac.digest("hex");
};

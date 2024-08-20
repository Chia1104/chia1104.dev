import jwt from "jsonwebtoken";

import { authTokenSchema } from "./types";

export const encodeApiKey = (apiKey: string, hashSecret: string) => {
  return jwt.sign({ apiKey }, hashSecret);
};

export const verifyApiKey = (token: string, hashSecret: string) => {
  return authTokenSchema.parse(jwt.verify(token, hashSecret));
};

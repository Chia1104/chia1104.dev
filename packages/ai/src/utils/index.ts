import {
  generateKeyPairSync,
  publicEncrypt,
  privateDecrypt,
} from "node:crypto";

import GithubSlugger from "github-slugger";
import * as z from "zod";

/**
 * Imported by the API-key guards, so it must stay free of provider SDKs.
 * `createModel` lives in `./model`; the auth-token schema is declared here
 * rather than pulled from `./types`, which reaches `ai` for `modelMessageSchema`.
 */

export const slugger = new GithubSlugger();

export const authTokenSchema = z.object({
  apiKey: z.string().min(1),
});

export type AuthToken = z.infer<typeof authTokenSchema>;

export function generateKeys() {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
    },
  });
  return { publicKey, privateKey };
}

export const encodeApiKey = (apiKey: string, publicKey: string): string => {
  const buffer = Buffer.from(apiKey, "utf8");
  const _publicKey = Buffer.from(publicKey, "base64").toString("utf-8");
  const encrypted = publicEncrypt(_publicKey, buffer);
  return encrypted.toString("base64");
};

export const decodeApiKey = (
  encryptedApiKey: string,
  privateKey: string
): string => {
  const buffer = Buffer.from(encryptedApiKey, "base64");
  const _privateKey = Buffer.from(privateKey, "base64").toString("utf-8");
  const decrypted = privateDecrypt(_privateKey, buffer);
  return decrypted.toString("utf8");
};

export const verifyApiKey = (token: string, privateKey: string) => {
  return authTokenSchema.parse({
    apiKey: decodeApiKey(token, privateKey),
  });
};

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { env } from "./env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TOKEN_FORMAT_VERSION = "v1";

const getEncryptionKey = () => {
  if (!env.SPOTIFY_TOKEN_ENCRYPTION_KEY) {
    throw new Error("SPOTIFY_TOKEN_ENCRYPTION_KEY is not configured");
  }

  const key = Buffer.from(env.SPOTIFY_TOKEN_ENCRYPTION_KEY, "base64");
  if (key.length !== 32) {
    throw new Error("SPOTIFY_TOKEN_ENCRYPTION_KEY must decode to 32 bytes");
  }

  return key;
};

export const encryptSpotifyToken = (token: string) => {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    TOKEN_FORMAT_VERSION,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
};

export const decryptSpotifyToken = (encryptedToken: string) => {
  const [version, iv, authTag, ciphertext] = encryptedToken.split(".");
  if (version !== TOKEN_FORMAT_VERSION || !iv || !authTag || !ciphertext) {
    throw new Error("Invalid encrypted Spotify token");
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    Buffer.from(iv, "base64url")
  );
  decipher.setAuthTag(Buffer.from(authTag, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
};

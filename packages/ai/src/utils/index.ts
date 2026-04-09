import {
  generateKeyPairSync,
  publicEncrypt,
  privateDecrypt,
} from "node:crypto";

import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import GithubSlugger from "github-slugger";

import type { BaseRequest } from "./types";
import { Provider } from "./types";
import { authTokenSchema } from "./types";

export const slugger = new GithubSlugger();

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

export const createModel = (
  options: Pick<BaseRequest, "model" | "authToken" | "proxyUrl">,
  formater?: ((model: BaseRequest["model"]) => LanguageModel) | "ai-gateway-v3"
): LanguageModel => {
  if (formater) {
    if (typeof formater === "function") {
      return formater(options.model);
    }
    switch (formater) {
      case "ai-gateway-v3":
        return `${options.model.provider}/${options.model.id}`;
      default:
        throw new Error("Invalid formater");
    }
  }
  switch (options.model.provider) {
    case Provider.OpenAI:
      return createOpenAI({
        apiKey: options.authToken,
        baseURL: options.proxyUrl,
      })(options.model.id);
    case Provider.Anthropic:
      return createAnthropic({
        apiKey: options.authToken,
        baseURL: options.proxyUrl,
      })(options.model.id);
    case Provider.Google:
      return createGoogleGenerativeAI({
        apiKey: options.authToken,
        baseURL: options.proxyUrl,
      })(options.model.id);
    default:
      throw new Error("Invalid provider");
  }
};

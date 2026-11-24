import * as z from "zod";

import { isEnumValue } from "@chia/utils/is";

import { randomToken, sha256 } from "./crypto";

/** What an API key may do; stored as-is in the key's `scopes` column. */
export const ApiKeyScope = {
  FeedsRead: "feeds:read",
  FeedsWrite: "feeds:write",
  SpotifyRead: "spotify:read",
  ToolingsRead: "toolings:read",
  /** Acts as the configured admin: `CallerTier.Root`. Only a key the admin owns can carry it. */
  OperatorRoot: "operator:root",
} as const;

export type ApiKeyScope = (typeof ApiKeyScope)[keyof typeof ApiKeyScope];

export const apiKeyScopeSchema = z.enum(ApiKeyScope);

export const apiKeyScopesSchema = z.array(apiKeyScopeSchema).min(1);

/** Unknown values are dropped so a stale row cannot surface a scope the UI has no name for. */
export const toApiKeyScopes = (stored: readonly string[]): ApiKeyScope[] =>
  stored.filter((scope): scope is ApiKeyScope =>
    isEnumValue(ApiKeyScope, scope)
  );

const API_KEY_PREFIX = "ch_";
/** Characters of the raw key kept in clear so the owner can tell keys apart. */
const API_KEY_START_LENGTH = 6;

/** The raw key is returned once to its creator; only the hash is stored. */
export const generateApiKey = async () => {
  const key = `${API_KEY_PREFIX}${randomToken()}`;
  return {
    key,
    keyHash: await hashApiKey(key),
    start: key.slice(0, API_KEY_START_LENGTH),
  };
};

export const hashApiKey = (key: string) => sha256(key);

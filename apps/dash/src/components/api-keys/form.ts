import * as z from "zod";

import {
  ApiKeyScope,
  apiKeyScopesSchema,
  toApiKeyScopes,
} from "@chia/auth/apikey";

import type { RouterInputs, RouterOutputs } from "@/libs/orpc/types";

/** The form is the write payload: name plus scopes, validated once by the contract schemas. */

export type ApiKeyView = RouterOutputs["apikey"]["list"]["items"][number];
export type ApiKeyWrite = RouterInputs["apikey"]["create"];

export const apiKeyFormSchema = z.object({
  name: z.string().trim().min(1, "Give the key a name"),
  scopes: apiKeyScopesSchema,
});

export type ApiKeyFormInput = z.input<typeof apiKeyFormSchema>;
export type ApiKeyFormOutput = z.output<typeof apiKeyFormSchema>;

export const SCOPES = Object.values(ApiKeyScope);

export const SCOPE_HINT = {
  [ApiKeyScope.FeedsRead]: "List and read posts, drafts included.",
  [ApiKeyScope.FeedsWrite]:
    "Update a post's metadata, translations and content.",
  [ApiKeyScope.SpotifyRead]: "Read the public playlist.",
  [ApiKeyScope.OperatorRoot]:
    "Act as you: every route your session can reach, the writing agent included. Only your own keys get it.",
} satisfies Record<ApiKeyScope, string>;

export const emptyFormValues = (): ApiKeyFormInput => ({
  name: "",
  scopes: [],
});

export const formValuesOf = (item: ApiKeyView): ApiKeyFormInput => ({
  name: item.name ?? "",
  scopes: toApiKeyScopes(item.permissions),
});

export type ApiKeyState = "active" | "revoked" | "expired";

export const stateOf = (item: ApiKeyView, now = Date.now()): ApiKeyState => {
  if (item.enabled === false) return "revoked";
  if (item.expiresAt && new Date(item.expiresAt).getTime() <= now) {
    return "expired";
  }
  return "active";
};

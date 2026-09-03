import * as z from "zod";

/**
 * What an API key may do. Persisted in better-auth's `permissions` column as
 * `{ resource: [action] }`; `resource:action` is the wire and UI spelling.
 */
export const ApiKeyScope = {
  FeedsRead: "feeds:read",
  FeedsWrite: "feeds:write",
  SpotifyRead: "spotify:read",
  /** Acts as the configured admin: `CallerTier.Root`. Only a key the admin owns can carry it. */
  OperatorRoot: "operator:root",
} as const;

export type ApiKeyScope = (typeof ApiKeyScope)[keyof typeof ApiKeyScope];

export const apiKeyScopeSchema = z.enum(ApiKeyScope);

export const apiKeyScopesSchema = z.array(apiKeyScopeSchema).min(1);

export type ApiKeyPermissions = Record<string, string[]>;

export const apiKeyPermissionsSchema: z.ZodType<ApiKeyPermissions> = z.record(
  z.string(),
  z.array(z.string())
);

const splitScope = (scope: ApiKeyScope): [resource: string, action: string] => {
  const [resource, action] =
    /* SAFETY: Every ApiKeyScope literal is `resource:action`. */ scope.split(
      ":"
    ) as [string, string];
  return [resource, action];
};

export const toApiKeyPermissions = (scopes: readonly ApiKeyScope[]) => {
  const permissions: ApiKeyPermissions = {};
  for (const scope of scopes) {
    const [resource, action] = splitScope(scope);
    const actions = (permissions[resource] ??= []);
    if (!actions.includes(action)) actions.push(action);
  }
  return permissions;
};

export const hasApiKeyScope = (
  permissions: ApiKeyPermissions | null | undefined,
  scope: ApiKeyScope
): boolean => {
  const [resource, action] = splitScope(scope);
  return permissions?.[resource]?.includes(action) ?? false;
};

/** Unknown resources or actions are dropped so a stale row cannot surface a scope the UI has no name for. */
export const toApiKeyScopes = (
  permissions: ApiKeyPermissions | null | undefined
): ApiKeyScope[] =>
  Object.values(ApiKeyScope).filter((scope) =>
    hasApiKeyScope(permissions, scope)
  );

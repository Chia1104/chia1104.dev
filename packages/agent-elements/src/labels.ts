import enUS from "@chia/i18n/agent-elements/en-US.json";

/**
 * Every user-visible string, shaped by the `en-US` catalog in `@chia/i18n/agent-elements`. A
 * host passes the catalog for its locale (or any partial override) into the store; the elements
 * read it from there, so both apps localise the same way.
 */
export type AgentLabels = typeof enUS;

export const defaultAgentLabels: AgentLabels = enUS;

/** Fills `{name}` placeholders in a catalog template. */
export const fill = (
  template: string,
  params: Readonly<Record<string, string>>
): string =>
  template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(params, key)
      ? (params[key] ?? match)
      : match
  );

export const mergeLabels = (
  overrides: Partial<AgentLabels> | undefined
): AgentLabels =>
  overrides
    ? {
        ...defaultAgentLabels,
        ...overrides,
        thinkingLevelNames: {
          ...defaultAgentLabels.thinkingLevelNames,
          ...overrides.thinkingLevelNames,
        },
        errorHeadlines: {
          ...defaultAgentLabels.errorHeadlines,
          ...overrides.errorHeadlines,
        },
      }
    : defaultAgentLabels;

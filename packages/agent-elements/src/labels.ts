import enUS from "@chia/i18n/agent-elements/en-US.json";

/**
 * User-visible strings, shaped by `@chia/i18n/agent-elements`. The host passes its locale
 * catalog (or a partial override).
 */
export type AgentLabels = typeof enUS;

export const defaultAgentLabels: AgentLabels = enUS;

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

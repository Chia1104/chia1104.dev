const NON_ALPHANUMERIC = /[^a-z0-9]+/g;

const containsNonAscii = (value: string): boolean =>
  Array.from(value).some((character) => character.charCodeAt(0) > 127);

/**
 * Lowercase hyphenated slug. Returns `undefined` for non-ASCII input rather
 * than dropping words; callers must supply English wording themselves.
 */
export const normalizeAsciiSlug = (input: string): string | undefined => {
  const trimmed = input.trim();
  if (trimmed.length === 0 || containsNonAscii(trimmed)) return undefined;

  const slug = trimmed
    .toLowerCase()
    .replaceAll(NON_ALPHANUMERIC, "-")
    .replaceAll(/^-|-$/g, "");
  return slug.length > 0 ? slug : undefined;
};

const NON_ALPHANUMERIC = /[^a-z0-9]+/g;

const containsNonAscii = (value: string): boolean =>
  Array.from(value).some((character) => character.charCodeAt(0) > 127);

/**
 * Normalises an English/ASCII phrase into a lowercase, hyphenated URL slug.
 *
 * Returns `undefined` for non-ASCII input rather than silently dropping words. This is a syntax
 * normaliser, not a translator or transliterator; callers must supply the meaningful English
 * wording themselves.
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

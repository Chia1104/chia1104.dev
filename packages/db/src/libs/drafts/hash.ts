import { createHash } from "node:crypto";

import type { FeedDraftSnapshot } from "../../schemas/schema.ts";
import { toStorableString } from "../../storable.ts";

/**
 * `-` for null, else `+<utf-8 byte length>:<value>`. Length-prefixed so adjacent fields cannot
 * run together, and plain enough that a SQL backfill reproduces it with `octet_length`.
 */
const field = (value: string | null): string => {
  if (value === null) return "-";
  const stored = toStorableString(value);
  return `+${Buffer.byteLength(stored)}:${stored}`;
};

/**
 * The identity of a draft's content: sha256 over its fields in a fixed order, locales sorted
 * bytewise. Values are hashed as Postgres stores them, so a draft read back hashes the same.
 * A change to this layout must rehash `feed_draft` and `feed_draft_revision` in its migration.
 */
export const hashFeedDraftSnapshot = (snapshot: FeedDraftSnapshot): string => {
  const hash = createHash("sha256");
  hash.update(field(snapshot.slug));
  hash.update(field(snapshot.type));
  hash.update(field(snapshot.defaultLocale));
  hash.update(field(snapshot.mainImage));
  for (const locale of Object.keys(snapshot.translations).sort()) {
    // SAFETY: snapshot translations are keyed by Locale.
    const translation =
      snapshot.translations[locale as keyof typeof snapshot.translations];
    if (!translation) continue;
    hash.update(field(locale));
    hash.update(field(translation.title));
    hash.update(field(translation.excerpt));
    hash.update(field(translation.description));
    hash.update(field(translation.summary));
    hash.update(field(translation.content));
  }
  return hash.digest("hex");
};

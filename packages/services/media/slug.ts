import { slug as slugify } from "github-slugger";

import { Locale } from "@chia/db/types";
import type { MediaSource } from "@chia/db/types";

import type { MediaSnapshot } from "./catalogue.service";

const BASE_MAX_CHARS = 80;

/**
 * Slugs to try for a new entry, most readable first. The last one carries the catalogue id, which
 * no other row can have, so one of them is always free.
 */
export const mediaSlugCandidates = (
  snapshot: Pick<
    MediaSnapshot,
    "translations" | "originalTitle" | "releaseYear"
  >,
  source: MediaSource,
  sourceId: string
): string[] => {
  const unique = `${source.replace(":", "-")}-${sourceId}`;
  const base = slugify(
    snapshot.translations[Locale.En]?.title ??
      snapshot.originalTitle ??
      snapshot.translations[Locale.ZhTW]?.title ??
      ""
  ).slice(0, BASE_MAX_CHARS);
  if (!base) return [unique];
  return [
    base,
    ...(snapshot.releaseYear === null
      ? []
      : [`${base}-${snapshot.releaseYear}`]),
    `${base}-${unique}`,
  ];
};

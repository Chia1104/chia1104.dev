import { and, eq, inArray } from "drizzle-orm";

import type { Locale } from "../../schemas/enums.ts";
import * as schema from "../../schemas/schema.ts";
import { withDTO } from "../index.ts";
import { findSimilarResources } from "../resources/search.ts";

const t = schema.feedTranslations;
const f = schema.feeds;

const FEED_TRANSLATION_SOURCE_TYPE = "feed_translation";

/**
 * Posts related to one feed, by card-vector similarity.
 *
 * Resolves the slug to its translation, asks the resource layer for similar
 * cards, then maps the translation ids back to feeds.
 */
export const getRelatedFeeds = withDTO(
  async (
    db,
    dto: {
      slug: string;
      locale: Locale;
      model: string;
      limit?: number;
      threshold?: number;
    }
  ) => {
    const [source] = await db
      .select({ translationId: t.id, feedId: t.feedId })
      .from(t)
      .innerJoin(f, eq(f.id, t.feedId))
      .where(and(eq(f.slug, dto.slug), eq(t.locale, dto.locale)))
      .limit(1);

    if (!source) {
      return [];
    }

    const limit = dto.limit ?? 3;

    // over-fetch: the hits are per translation, and collapsing them onto feeds
    // below can drop several. `+ 1` covers only the source's own other
    // translation, so `limit` was never reachable once two locales matched
    const similar = await findSimilarResources(db, {
      sourceType: FEED_TRANSLATION_SOURCE_TYPE,
      sourceId: source.translationId,
      model: dto.model,
      locale: dto.locale,
      limit: limit * 3 + 1,
      threshold: dto.threshold,
    });

    const translationIds = similar.map((row) => row.sourceId);
    if (translationIds.length === 0) {
      return [];
    }

    const rows = await db
      .select({
        translationId: t.id,
        id: f.id,
        type: f.type,
        slug: f.slug,
        locale: t.locale,
        title: t.title,
        description: t.description,
        excerpt: t.excerpt,
        createdAt: f.createdAt,
      })
      .from(t)
      .innerJoin(f, eq(f.id, t.feedId))
      .where(inArray(t.id, translationIds));

    const byTranslation = new Map(rows.map((row) => [row.translationId, row]));

    // preserve similarity order; drop other translations of the same feed, then
    // apply the caller's limit — before dedup it would count translations
    const seenFeeds = new Set([source.feedId]);
    return similar
      .flatMap((hit) => {
        const row = byTranslation.get(hit.sourceId);
        if (!row || seenFeeds.has(row.id)) {
          return [];
        }
        seenFeeds.add(row.id);
        const { translationId: _translationId, ...feed } = row;
        return [{ ...feed, similarity: hit.similarity }];
      })
      .slice(0, limit);
  }
);

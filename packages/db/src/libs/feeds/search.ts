import { and, eq, inArray, isNull } from "drizzle-orm";

import type { Locale } from "../../schemas/enums.ts";
import * as schema from "../../schemas/schema.ts";
import { withDTO } from "../index.ts";
import { findSimilarResources } from "../resources/search.ts";

const t = schema.feedTranslations;
const f = schema.feeds;

const FEED_TRANSLATION_SOURCE_TYPE = "feed_translation";

/**
 * Posts related to one feed, by card-vector similarity. `scope` bounds both the source and the
 * results: the query is addressable by slug and the vectors cover drafts, so a public caller
 * passing an unpublished slug or matching a draft would otherwise read it.
 */
export const getRelatedFeeds = withDTO(
  async (
    db,
    dto: {
      slug: string;
      locale: Locale;
      model: string;
      scope: { userId: string; published?: boolean; enableDeleted: boolean };
      limit?: number;
      threshold?: number;
    }
  ) => {
    const visible = and(
      eq(f.userId, dto.scope.userId),
      dto.scope.published === undefined
        ? undefined
        : eq(f.published, dto.scope.published),
      dto.scope.enableDeleted ? undefined : isNull(f.deletedAt)
    );

    const [source] = await db
      .select({ translationId: t.id, feedId: t.feedId })
      .from(t)
      .innerJoin(f, eq(f.id, t.feedId))
      .where(and(eq(f.slug, dto.slug), eq(t.locale, dto.locale), visible))
      .limit(1);

    if (!source) {
      return [];
    }

    const limit = dto.limit ?? 3;

    // Hits are per translation; collapsing onto feeds can drop several. `+ 1` only covers the source's other locale.
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
      .where(and(inArray(t.id, translationIds), visible));

    const byTranslation = new Map(rows.map((row) => [row.translationId, row]));

    // Preserve similarity order, drop other translations of the same feed, then apply `limit`.
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

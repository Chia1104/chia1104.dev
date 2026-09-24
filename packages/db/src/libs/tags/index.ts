import { and, eq, inArray, notInArray, sql } from "drizzle-orm";

import type { DB } from "../../client.ts";
import {
  feeds,
  feedsToTags,
  tags,
  tagTranslations,
} from "../../schemas/schema.ts";
import { Locale } from "../../types.ts";
import type { TagWrite } from "../validator/tags.ts";

export interface TagTranslationView {
  name: string;
  description: string | null;
}

export interface TagRecord {
  id: number;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
  translations: Partial<Record<Locale, TagTranslationView>>;
  /** Live feeds carrying the tag; drafts included unless the scope is published. */
  feedCount: number;
}

export interface TagCountScope {
  /** `true` counts published feeds only; `undefined` counts every live feed. */
  published?: true;
}

const feedCountOf = (tagId: typeof tags.id, scope: TagCountScope) =>
  sql<number>`(
    select count(*) from ${feedsToTags} ft
    join ${feeds} f on f.id = ft.feed_id
    where ft.tag_id = ${tagId} and f.deleted_at is null
    ${scope.published ? sql`and f.published` : sql``}
  )::int`;

const toRecord = (row: {
  id: number;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
  feedCount: number;
  translations: { locale: Locale; name: string; description: string | null }[];
}): TagRecord => ({
  id: row.id,
  slug: row.slug,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  feedCount: row.feedCount,
  translations: Object.fromEntries(
    row.translations.map((translation) => [
      translation.locale,
      { name: translation.name, description: translation.description },
    ])
  ),
});

/** Unpaginated: the taxonomy is bounded. Ordered by slug. */
export const listTags = async (
  db: DB,
  scope: TagCountScope = {}
): Promise<TagRecord[]> => {
  const rows = await db.query.tags.findMany({
    with: { translations: true },
    orderBy: (tag, { asc }) => [asc(tag.slug)],
    extras: {
      feedCount: (tag) => feedCountOf(tag.id, scope).as("feed_count"),
    },
  });
  return rows.map(toRecord);
};

export const getTag = async (
  db: DB,
  id: number
): Promise<TagRecord | undefined> => {
  const row = await db.query.tags.findFirst({
    where: { id },
    with: { translations: true },
    extras: {
      feedCount: (tag) => feedCountOf(tag.id, {}).as("feed_count"),
    },
  });
  return row ? toRecord(row) : undefined;
};

export const getTagIdBySlug = async (
  db: DB,
  slug: string
): Promise<number | undefined> => {
  const [row] = await db
    .select({ id: tags.id })
    .from(tags)
    .where(eq(tags.slug, slug))
    .limit(1);
  return row?.id;
};

const translationRows = (tagId: number, write: TagWrite) =>
  Object.values(Locale).map((locale) => ({
    tagId,
    locale,
    name: write.translations[locale].name,
    description: write.translations[locale].description,
  }));

export const createTag = async (
  db: DB,
  write: TagWrite
): Promise<TagRecord> => {
  const id = await db.transaction(async (tx) => {
    const [tag] = await tx
      .insert(tags)
      .values({ slug: write.slug })
      .returning({ id: tags.id });
    if (!tag) throw new Error("Tag was not inserted.");
    await tx.insert(tagTranslations).values(translationRows(tag.id, write));
    return tag.id;
  });
  const record = await getTag(db, id);
  if (!record) throw new Error("Tag was not inserted.");
  return record;
};

/** Both translations are written whole; `undefined` when no tag has this id. */
export const updateTag = async (
  db: DB,
  id: number,
  write: TagWrite
): Promise<TagRecord | undefined> => {
  const found = await db.transaction(async (tx) => {
    const [tag] = await tx
      .update(tags)
      .set({ slug: write.slug, updatedAt: new Date() })
      .where(eq(tags.id, id))
      .returning({ id: tags.id });
    if (!tag) return false;
    await tx
      .insert(tagTranslations)
      .values(translationRows(tag.id, write))
      .onConflictDoUpdate({
        target: [tagTranslations.tagId, tagTranslations.locale],
        set: {
          name: sql`excluded.name`,
          description: sql`excluded.description`,
        },
      });
    return true;
  });
  return found ? await getTag(db, id) : undefined;
};

/** Hard delete; feed links go with it. */
export const deleteTag = async (db: DB, id: number): Promise<boolean> => {
  const [row] = await db
    .delete(tags)
    .where(eq(tags.id, id))
    .returning({ id: tags.id });
  return row !== undefined;
};

/** The ids among `tagIds` that name a tag. */
export const findTagIds = async (
  db: DB,
  tagIds: number[]
): Promise<number[]> => {
  if (tagIds.length === 0) return [];
  const rows = await db
    .select({ id: tags.id })
    .from(tags)
    .where(inArray(tags.id, tagIds));
  return rows.map((row) => row.id);
};

/** Makes `tagIds` the feed's whole tag set. Callers verify the ids first; an unknown one fails the foreign key. */
export const setFeedTags = async (
  db: DB,
  { feedId, tagIds }: { feedId: number; tagIds: number[] }
): Promise<void> => {
  const wanted = [...new Set(tagIds)];
  await db.transaction(async (tx) => {
    await tx
      .delete(feedsToTags)
      .where(
        and(
          eq(feedsToTags.feedId, feedId),
          wanted.length > 0 ? notInArray(feedsToTags.tagId, wanted) : undefined
        )
      );
    if (wanted.length > 0) {
      await tx
        .insert(feedsToTags)
        .values(wanted.map((tagId) => ({ feedId, tagId })))
        .onConflictDoNothing();
    }
  });
};

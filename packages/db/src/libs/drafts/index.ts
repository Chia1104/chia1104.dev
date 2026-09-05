import { and, desc, eq, gt, inArray, isNull, lt, or, sql } from "drizzle-orm";

import type { DB } from "../../client.ts";
import type {
  FeedDraftAuthor,
  FeedDraftChange,
  FeedDraftRevision,
  FeedDraftSnapshot,
  FeedDraftTranslationSnapshot,
  FeedType,
  Locale,
} from "../../schemas/schema.ts";
import {
  FEED_DRAFT_AUTHOR,
  feedDraftRevisions,
  feedDrafts,
  feedDraftTranslations,
} from "../../schemas/schema.ts";

import { FEED_DRAFT_CHANNEL } from "./notice.ts";
import type { FeedDraftNotice } from "./notice.ts";

/**
 * `feed_draft` with its translations, revision trail and compare-and-set writes. Every write
 * runs in one transaction that locks the draft row, so two writers cannot interleave.
 */

export type StorableFeedType = Exclude<FeedType, "all">;

export type { FeedDraftSnapshot, FeedDraftTranslationSnapshot };

export interface FeedDraftRecord extends FeedDraftSnapshot {
  id: number;
  feedId: number | null;
  userId: string;
  revision: number;
  appliedRevision: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/** `undefined` leaves a field alone; `null` clears it. */
export type FeedDraftTranslationPatch = Partial<FeedDraftTranslationSnapshot>;

export interface FeedDraftMetaPatch {
  slug?: string | null;
  type?: StorableFeedType;
  defaultLocale?: Locale;
  mainImage?: string | null;
}

export interface FeedDraftWriter {
  author: FeedDraftAuthor;
  sessionId?: string | null;
}

export type FeedDraftWriteResult =
  | { status: "ok"; draft: FeedDraftRecord }
  /** `expectedRevision` is behind; `draft` is the current state so the caller can rebase. */
  | { status: "conflict"; draft: FeedDraftRecord }
  | { status: "not_found" };

/** Operator saves closer together than this update the newest revision instead of adding one. */
const OPERATOR_COALESCE_MS = 10 * 60 * 1000;
/** Restore points kept per draft; older rows are pruned on write. */
const MAX_REVISIONS_PER_DRAFT = 100;

const TRANSLATION_FIELDS = [
  "title",
  "excerpt",
  "description",
  "summary",
  "content",
] as const;

const META_FIELDS = ["slug", "type", "defaultLocale", "mainImage"] as const;

type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];

/** Queued on the transaction; Postgres delivers it on commit and drops it on rollback. */
const notifyFeedDraft = (tx: Tx, notice: FeedDraftNotice) =>
  tx.execute(
    sql`select pg_notify(${FEED_DRAFT_CHANNEL}, ${JSON.stringify(notice)})`
  );

const toRecord = (
  draft: typeof feedDrafts.$inferSelect,
  rows: (typeof feedDraftTranslations.$inferSelect)[]
): FeedDraftRecord => {
  const translations: FeedDraftRecord["translations"] = {};
  for (const row of rows) {
    translations[row.locale] = {
      title: row.title,
      excerpt: row.excerpt,
      description: row.description,
      summary: row.summary,
      content: row.content,
    };
  }
  return {
    id: draft.id,
    feedId: draft.feedId,
    userId: draft.userId,
    slug: draft.slug,
    type: draft.type,
    defaultLocale: draft.defaultLocale,
    mainImage: draft.mainImage,
    revision: draft.revision,
    appliedRevision: draft.appliedRevision,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
    translations,
  };
};

const snapshotOf = (draft: FeedDraftRecord): FeedDraftSnapshot => ({
  slug: draft.slug,
  type: draft.type,
  defaultLocale: draft.defaultLocale,
  mainImage: draft.mainImage,
  translations: draft.translations,
});

const readDraft = async (
  db: DB | Tx,
  draftId: number,
  lock = false
): Promise<FeedDraftRecord | null> => {
  const query = db.select().from(feedDrafts).where(eq(feedDrafts.id, draftId));
  const [draft] = lock ? await query.for("update") : await query;
  if (!draft) return null;
  const rows = await db
    .select()
    .from(feedDraftTranslations)
    .where(eq(feedDraftTranslations.draftId, draftId));
  return toRecord(draft, rows);
};

export const getFeedDraft = (db: DB, draftId: number) => readDraft(db, draftId);

/** State needed by watch streams, without translation bodies. */
export const getFeedDraftStatus = async (db: DB, draftId: number) => {
  const [draft] = await db
    .select({
      userId: feedDrafts.userId,
      feedId: feedDrafts.feedId,
      revision: feedDrafts.revision,
      appliedRevision: feedDrafts.appliedRevision,
    })
    .from(feedDrafts)
    .where(eq(feedDrafts.id, draftId));
  return draft ?? null;
};

const readDraftTranslations = async (
  db: DB,
  drafts: (typeof feedDrafts.$inferSelect)[]
): Promise<FeedDraftRecord[]> => {
  if (drafts.length === 0) return [];
  const rows = await db
    .select()
    .from(feedDraftTranslations)
    .where(
      inArray(
        feedDraftTranslations.draftId,
        drafts.map((draft) => draft.id)
      )
    );
  const translations = new Map<number, typeof rows>();
  for (const row of rows) {
    const group = translations.get(row.draftId) ?? [];
    group.push(row);
    translations.set(row.draftId, group);
  }
  return drafts.map((draft) =>
    toRecord(draft, translations.get(draft.id) ?? [])
  );
};

/** Reads a session's drafts in the requested order, omitting discarded rows. */
export const getFeedDrafts = async (db: DB, draftIds: readonly number[]) => {
  if (draftIds.length === 0) return [];
  const drafts = await db
    .select()
    .from(feedDrafts)
    .where(inArray(feedDrafts.id, [...draftIds]));
  const byId = new Map(drafts.map((draft) => [draft.id, draft]));
  return readDraftTranslations(
    db,
    draftIds.flatMap((id) => {
      const draft = byId.get(id);
      return draft ? [draft] : [];
    })
  );
};

export const getFeedDraftByFeedId = async (db: DB, feedId: number) => {
  const [draft] = await db
    .select({ id: feedDrafts.id })
    .from(feedDrafts)
    .where(eq(feedDrafts.feedId, feedId));
  return draft ? readDraft(db, draft.id) : null;
};

/**
 * Drafts the operator still has work in: never applied, or edited since the last apply.
 */
export const listOpenFeedDrafts = async (db: DB, userId: string) => {
  const drafts = await db
    .select()
    .from(feedDrafts)
    .where(
      and(
        eq(feedDrafts.userId, userId),
        or(
          isNull(feedDrafts.appliedRevision),
          lt(feedDrafts.appliedRevision, feedDrafts.revision)
        )
      )
    )
    .orderBy(desc(feedDrafts.updatedAt));
  return readDraftTranslations(db, drafts);
};

/**
 * Appends a revision, folding it into the newest one when the same operator saved moments
 * ago, and prunes the trail to {@link MAX_REVISIONS_PER_DRAFT}.
 */
const recordRevision = async (
  tx: Tx,
  draft: FeedDraftRecord,
  writer: FeedDraftWriter,
  changes: FeedDraftChange[]
) => {
  const [latest] = await tx
    .select()
    .from(feedDraftRevisions)
    .where(eq(feedDraftRevisions.draftId, draft.id))
    .orderBy(desc(feedDraftRevisions.revision))
    .limit(1);

  const coalesce =
    latest !== undefined &&
    writer.author === FEED_DRAFT_AUTHOR.Operator &&
    latest.author === FEED_DRAFT_AUTHOR.Operator &&
    Date.now() - latest.updatedAt.getTime() < OPERATOR_COALESCE_MS;

  const snapshot = snapshotOf(draft);

  if (coalesce) {
    await tx
      .update(feedDraftRevisions)
      .set({
        revision: draft.revision,
        changes: mergeChanges(latest.changes, changes),
        snapshot,
        updatedAt: new Date(),
      })
      .where(eq(feedDraftRevisions.id, latest.id));
    return;
  }

  await tx.insert(feedDraftRevisions).values({
    draftId: draft.id,
    revision: draft.revision,
    author: writer.author,
    sessionId: writer.sessionId ?? null,
    changes,
    snapshot,
  });

  await tx.delete(feedDraftRevisions).where(
    and(
      eq(feedDraftRevisions.draftId, draft.id),
      sql`${feedDraftRevisions.id} not in (
        select id from ${feedDraftRevisions}
        where ${feedDraftRevisions.draftId} = ${draft.id}
        order by ${feedDraftRevisions.revision} desc
        limit ${MAX_REVISIONS_PER_DRAFT}
      )`
    )
  );
};

export const mergeChanges = (
  base: FeedDraftChange[],
  next: FeedDraftChange[]
): FeedDraftChange[] => {
  const byLocale = new Map<Locale | null, Set<string>>();
  for (const change of [...base, ...next]) {
    const key = change.locale ?? null;
    const fields = byLocale.get(key) ?? new Set<string>();
    for (const field of change.fields) fields.add(field);
    byLocale.set(key, fields);
  }
  return [...byLocale.entries()].map(([locale, fields]) => {
    const change: FeedDraftChange = { fields: [...fields] };
    if (locale !== null) change.locale = locale;
    return change;
  });
};

/** The names in `allowed` whose value in `patch` is not `undefined`. */
const definedKeys = <TPatch extends object>(
  patch: TPatch,
  allowed: readonly (keyof TPatch & string)[]
): (keyof TPatch & string)[] =>
  allowed.filter((key) => patch[key] !== undefined);

export interface CreateFeedDraftInput extends FeedDraftWriter {
  userId: string;
  feedId?: number | null;
  snapshot?: Partial<FeedDraftSnapshot>;
  /** Set when the draft is opened from an existing feed, so it does not look unapplied. */
  applied?: boolean;
}

export const createFeedDraft = (
  db: DB,
  input: CreateFeedDraftInput
): Promise<FeedDraftRecord> =>
  db.transaction(async (tx) => {
    const [draft] = await tx
      .insert(feedDrafts)
      .values({
        userId: input.userId,
        feedId: input.feedId ?? null,
        slug: input.snapshot?.slug ?? null,
        type: input.snapshot?.type ?? "post",
        defaultLocale: input.snapshot?.defaultLocale ?? "zh-TW",
        mainImage: input.snapshot?.mainImage ?? null,
        revision: 1,
        appliedRevision: input.applied ? 1 : null,
      })
      .returning();
    if (!draft) throw new Error("Creating the draft returned no row.");

    const translations = Object.entries(input.snapshot?.translations ?? {});
    if (translations.length > 0) {
      await tx.insert(feedDraftTranslations).values(
        translations.map(([locale, translation]) => ({
          draftId: draft.id,
          locale:
            /* SAFETY: snapshot translations are keyed by Locale. */ locale as Locale,
          ...translation,
        }))
      );
    }

    const record = (await readDraft(tx, draft.id))!;
    await recordRevision(tx, record, input, [
      { fields: [...META_FIELDS] },
      ...translations.map(([locale]) => ({
        locale:
          /* SAFETY: snapshot translations are keyed by Locale. */ locale as Locale,
        fields: [...TRANSLATION_FIELDS],
      })),
    ]);
    return record;
  });

export interface PatchFeedDraftInput extends FeedDraftWriter {
  draftId: number;
  /** Omit to write over whatever is current; agent edits that re-read first pass it. */
  expectedRevision?: number;
  meta?: FeedDraftMetaPatch;
  translations?: Partial<Record<Locale, FeedDraftTranslationPatch>>;
}

export const patchFeedDraft = (
  db: DB,
  input: PatchFeedDraftInput
): Promise<FeedDraftWriteResult> =>
  db.transaction(async (tx) => {
    const current = await readDraft(tx, input.draftId, true);
    if (!current) return { status: "not_found" };
    if (
      input.expectedRevision !== undefined &&
      input.expectedRevision !== current.revision
    ) {
      return { status: "conflict", draft: current };
    }

    const changes: FeedDraftChange[] = [];
    const metaFields = input.meta ? definedKeys(input.meta, META_FIELDS) : [];
    if (metaFields.length > 0) changes.push({ fields: metaFields });

    const translationEntries = Object.entries(input.translations ?? {})
      .map(([locale, patch]) => ({
        locale:
          /* SAFETY: patch translations are keyed by Locale. */ locale as Locale,
        patch: patch ?? {},
        fields: definedKeys(patch ?? {}, TRANSLATION_FIELDS),
      }))
      .filter((entry) => entry.fields.length > 0);
    for (const entry of translationEntries) {
      changes.push({ locale: entry.locale, fields: entry.fields });
    }

    if (changes.length === 0) return { status: "ok", draft: current };

    const revision = current.revision + 1;
    await tx
      .update(feedDrafts)
      .set({
        ...(input.meta ?? {}),
        revision,
        updatedAt: new Date(),
      })
      .where(eq(feedDrafts.id, input.draftId));

    for (const entry of translationEntries) {
      await tx
        .insert(feedDraftTranslations)
        .values({
          draftId: input.draftId,
          locale: entry.locale,
          ...entry.patch,
        })
        .onConflictDoUpdate({
          target: [feedDraftTranslations.draftId, feedDraftTranslations.locale],
          set: { ...entry.patch, updatedAt: new Date() },
        });
    }

    const draft = (await readDraft(tx, input.draftId))!;
    await recordRevision(tx, draft, input, changes);
    await notifyFeedDraft(tx, {
      type: "revision",
      draftId: draft.id,
      revision: draft.revision,
      author: input.author,
      sessionId: input.sessionId ?? null,
      changes,
    });
    return { status: "ok", draft };
  });

export interface ReplaceFeedDraftInput extends FeedDraftWriter {
  draftId: number;
  snapshot: FeedDraftSnapshot;
  expectedRevision?: number;
}

/** Whole-draft replacement: restore and reset-from-feed. Locales absent from the snapshot are dropped. */
export const replaceFeedDraft = (
  db: DB,
  input: ReplaceFeedDraftInput
): Promise<FeedDraftWriteResult> =>
  db.transaction(async (tx) => {
    const current = await readDraft(tx, input.draftId, true);
    if (!current) return { status: "not_found" };
    if (
      input.expectedRevision !== undefined &&
      input.expectedRevision !== current.revision
    ) {
      return { status: "conflict", draft: current };
    }

    const revision = current.revision + 1;
    await tx
      .update(feedDrafts)
      .set({
        slug: input.snapshot.slug,
        type: input.snapshot.type,
        defaultLocale: input.snapshot.defaultLocale,
        mainImage: input.snapshot.mainImage,
        revision,
        updatedAt: new Date(),
      })
      .where(eq(feedDrafts.id, input.draftId));
    await tx
      .delete(feedDraftTranslations)
      .where(eq(feedDraftTranslations.draftId, input.draftId));
    const translations = Object.entries(input.snapshot.translations);
    if (translations.length > 0) {
      await tx.insert(feedDraftTranslations).values(
        translations.map(([locale, translation]) => ({
          draftId: input.draftId,
          locale:
            /* SAFETY: snapshot translations are keyed by Locale. */ locale as Locale,
          ...translation,
        }))
      );
    }

    const draft = (await readDraft(tx, input.draftId))!;
    const locales = new Set([
      ...Object.keys(current.translations),
      ...Object.keys(draft.translations),
    ]);
    const changes: FeedDraftChange[] = [
      { fields: [...META_FIELDS] },
      ...[...locales].map((locale) => ({
        locale: /* SAFETY: keys are Locale values. */ locale as Locale,
        fields: [...TRANSLATION_FIELDS],
      })),
    ];
    await recordRevision(tx, draft, input, changes);
    await notifyFeedDraft(tx, {
      type: "revision",
      draftId: draft.id,
      revision: draft.revision,
      author: input.author,
      sessionId: input.sessionId ?? null,
      changes,
    });
    return { status: "ok", draft };
  });

export const markFeedDraftApplied = (
  db: DB,
  input: { draftId: number; feedId: number; revision: number }
) =>
  db.transaction(async (tx) => {
    await tx
      .update(feedDrafts)
      .set({ feedId: input.feedId, appliedRevision: input.revision })
      .where(eq(feedDrafts.id, input.draftId));
    await notifyFeedDraft(tx, { type: "applied", ...input });
  });

export const deleteFeedDraft = (db: DB, draftId: number) =>
  db.transaction(async (tx) => {
    await tx.delete(feedDrafts).where(eq(feedDrafts.id, draftId));
    await notifyFeedDraft(tx, { type: "discarded", draftId });
  });

export type FeedDraftRevisionSummary = Omit<FeedDraftRevision, "snapshot">;

export const listFeedDraftRevisions = async (
  db: DB,
  input: { draftId: number; limit: number }
): Promise<FeedDraftRevisionSummary[]> =>
  await db
    .select({
      id: feedDraftRevisions.id,
      draftId: feedDraftRevisions.draftId,
      revision: feedDraftRevisions.revision,
      author: feedDraftRevisions.author,
      sessionId: feedDraftRevisions.sessionId,
      changes: feedDraftRevisions.changes,
      createdAt: feedDraftRevisions.createdAt,
      updatedAt: feedDraftRevisions.updatedAt,
    })
    .from(feedDraftRevisions)
    .where(eq(feedDraftRevisions.draftId, input.draftId))
    .orderBy(desc(feedDraftRevisions.revision))
    .limit(input.limit);

/** Revisions above `afterRevision`, oldest first: what a watcher missed while away. */
export const getFeedDraftRevision = async (
  db: DB,
  input: { draftId: number; revisionId: number }
): Promise<FeedDraftRevision | null> => {
  const [row] = await db
    .select()
    .from(feedDraftRevisions)
    .where(
      and(
        eq(feedDraftRevisions.draftId, input.draftId),
        eq(feedDraftRevisions.id, input.revisionId)
      )
    );
  return row ?? null;
};

/** Operator revisions above `afterRevision`, oldest first, for the agent's turn context. */
export const listOperatorFeedDraftChanges = async (
  db: DB,
  input: { draftId: number; afterRevision: number }
): Promise<FeedDraftChange[]> => {
  const rows = await db
    .select({ changes: feedDraftRevisions.changes })
    .from(feedDraftRevisions)
    .where(
      and(
        eq(feedDraftRevisions.draftId, input.draftId),
        eq(feedDraftRevisions.author, FEED_DRAFT_AUTHOR.Operator),
        gt(feedDraftRevisions.revision, input.afterRevision)
      )
    )
    .orderBy(feedDraftRevisions.revision);
  return rows.reduce<FeedDraftChange[]>(
    (merged, row) => mergeChanges(merged, row.changes),
    []
  );
};

export const snapshotOfRevision = (revision: FeedDraftRevision) =>
  revision.snapshot;

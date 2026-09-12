import { and, desc, eq, gt, inArray, isNull, lt, or, sql } from "drizzle-orm";

import { applyEdits } from "@chia/utils/text";
import type {
  AppliedEdit,
  ContentEdit,
  ExactReplaceFailure,
} from "@chia/utils/text";

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

const translationOf = (
  row: typeof feedDraftTranslations.$inferSelect
): FeedDraftTranslationSnapshot => ({
  title: row.title,
  excerpt: row.excerpt,
  description: row.description,
  summary: row.summary,
  content: row.content,
});

const translationsOf = (
  rows: (typeof feedDraftTranslations.$inferSelect)[]
): FeedDraftRecord["translations"] => {
  const translations: FeedDraftRecord["translations"] = {};
  for (const row of rows) translations[row.locale] = translationOf(row);
  return translations;
};

const toRecord = (
  draft: typeof feedDrafts.$inferSelect,
  translations: FeedDraftRecord["translations"]
): FeedDraftRecord => {
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
  options: { lock?: boolean; userId?: string } = {}
): Promise<FeedDraftRecord | null> => {
  const query = db
    .select()
    .from(feedDrafts)
    .where(
      options.userId === undefined
        ? eq(feedDrafts.id, draftId)
        : and(eq(feedDrafts.id, draftId), eq(feedDrafts.userId, options.userId))
    );
  const [draft] = options.lock ? await query.for("update") : await query;
  if (!draft) return null;
  const rows = await db
    .select()
    .from(feedDraftTranslations)
    .where(eq(feedDraftTranslations.draftId, draftId));
  return toRecord(draft, translationsOf(rows));
};

/** One of `userId`'s drafts; anyone else's reads as null. */
export const getFeedDraft = (db: DB, draftId: number, userId: string) =>
  readDraft(db, draftId, { userId });

/** The draft under `FOR UPDATE`, so a compare-and-set on its revision holds until the transaction ends. */
export const getFeedDraftForUpdate = (tx: Tx, draftId: number) =>
  readDraft(tx, draftId, { lock: true });

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
    toRecord(draft, translationsOf(translations.get(draft.id) ?? []))
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

/** A draft as listed: every field but the translation bodies, which only `getFeedDraft` reads. */
export interface FeedDraftListItem extends Omit<
  FeedDraftRecord,
  "translations"
> {
  translations: Partial<Record<Locale, { title: string | null }>>;
}

/**
 * Drafts the operator still has work in: never applied, or edited since the last apply.
 */
export const listOpenFeedDrafts = async (
  db: DB,
  userId: string
): Promise<FeedDraftListItem[]> => {
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
  if (drafts.length === 0) return [];
  const titles = await db
    .select({
      draftId: feedDraftTranslations.draftId,
      locale: feedDraftTranslations.locale,
      title: feedDraftTranslations.title,
    })
    .from(feedDraftTranslations)
    .where(
      inArray(
        feedDraftTranslations.draftId,
        drafts.map((draft) => draft.id)
      )
    );
  const byDraft = new Map<number, FeedDraftListItem["translations"]>();
  for (const row of titles) {
    const translations = byDraft.get(row.draftId) ?? {};
    translations[row.locale] = { title: row.title };
    byDraft.set(row.draftId, translations);
  }
  return drafts.map((draft) => ({
    ...toRecord(draft, {}),
    translations: byDraft.get(draft.id) ?? {},
  }));
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

/** Who is writing. A draft another user owns answers `not_found`, checked on the locked row. */
export interface FeedDraftOwnedWrite extends FeedDraftWriter {
  draftId: number;
  userId: string;
  /** Omit to write over whatever is current. */
  expectedRevision?: number;
}

/** The draft under `FOR UPDATE` when it exists and belongs to `userId`; the write result otherwise. */
const lockOwnedDraft = async (
  tx: Tx,
  input: FeedDraftOwnedWrite
): Promise<
  | { status: "locked"; draft: FeedDraftRecord }
  | Exclude<FeedDraftWriteResult, { status: "ok" }>
> => {
  const current = await readDraft(tx, input.draftId, {
    lock: true,
    userId: input.userId,
  });
  if (!current) return { status: "not_found" };
  if (
    input.expectedRevision !== undefined &&
    input.expectedRevision !== current.revision
  ) {
    return { status: "conflict", draft: current };
  }
  return { status: "locked", draft: current };
};

export interface PatchFeedDraftInput extends FeedDraftOwnedWrite {
  meta?: FeedDraftMetaPatch;
  translations?: Partial<Record<Locale, FeedDraftTranslationPatch>>;
}

export const patchFeedDraft = (
  db: DB,
  input: PatchFeedDraftInput
): Promise<FeedDraftWriteResult> =>
  db.transaction(async (tx) => {
    const locked = await lockOwnedDraft(tx, input);
    if (locked.status !== "locked") return locked;
    return { status: "ok", draft: await writePatch(tx, locked.draft, input) };
  });

export type FeedDraftContentEdit = ContentEdit;

export interface EditFeedDraftContentInput extends FeedDraftOwnedWrite {
  locale: Locale;
  /** Applied in order, each against the body the previous one produced. */
  edits: readonly FeedDraftContentEdit[];
}

export type FeedDraftAppliedEdit = AppliedEdit;

export type FeedDraftEditResult =
  | { status: "ok"; draft: FeedDraftRecord; edits: FeedDraftAppliedEdit[] }
  | { status: "conflict"; draft: FeedDraftRecord }
  | { status: "not_found" }
  /** The locale has no body to edit. */
  | { status: "no_body" }
  /** Edit `index` did not match once; nothing was written. `message` says how to proceed. */
  | {
      status: "not_applied";
      index: number;
      reason: ExactReplaceFailure;
      message: string;
    };

/**
 * Exact-string replacements in one locale's body, matched against the body under the draft
 * lock and written as one revision. Without `expectedRevision` the edits land on whatever is
 * current, which is safe by construction: each target still matches once or the batch is
 * refused.
 */
export const editFeedDraftContent = (
  db: DB,
  input: EditFeedDraftContentInput
): Promise<FeedDraftEditResult> =>
  db.transaction(async (tx) => {
    const locked = await lockOwnedDraft(tx, input);
    if (locked.status !== "locked") return locked;
    const current = locked.draft;
    const body = current.translations[input.locale]?.content;
    if (body === undefined || body === null) return { status: "no_body" };

    const applied = applyEdits(body, input.edits);
    if (!applied.ok) return { status: "not_applied", ...applied };
    const content = applied.content;
    const draft = await writePatch(tx, current, {
      author: input.author,
      sessionId: input.sessionId,
      translations: { [input.locale]: { content } },
    });
    return { status: "ok", draft, edits: applied.edits };
  });

/** The write half of a patch, on a draft already locked and revision-checked. */
const writePatch = async (
  tx: Tx,
  current: FeedDraftRecord,
  input: FeedDraftWriter & Pick<PatchFeedDraftInput, "meta" | "translations">
): Promise<FeedDraftRecord> => {
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

  if (changes.length === 0) return current;

  const revision = current.revision + 1;
  const [row] = await tx
    .update(feedDrafts)
    .set({
      ...(input.meta ?? {}),
      revision,
      updatedAt: new Date(),
    })
    .where(eq(feedDrafts.id, current.id))
    .returning();
  if (!row) throw new Error(`Updating draft ${current.id} returned no row.`);

  const translations = { ...current.translations };
  for (const entry of translationEntries) {
    const [written] = await tx
      .insert(feedDraftTranslations)
      .values({
        draftId: current.id,
        locale: entry.locale,
        ...entry.patch,
      })
      .onConflictDoUpdate({
        target: [feedDraftTranslations.draftId, feedDraftTranslations.locale],
        set: { ...entry.patch, updatedAt: new Date() },
      })
      .returning();
    if (written) translations[entry.locale] = translationOf(written);
  }

  const draft = toRecord(row, translations);
  await recordRevision(tx, draft, input, changes);
  await notifyFeedDraft(tx, {
    type: "revision",
    draftId: draft.id,
    revision: draft.revision,
    author: input.author,
    sessionId: input.sessionId ?? null,
    changes,
  });
  return draft;
};

export interface ReplaceFeedDraftInput extends FeedDraftOwnedWrite {
  snapshot: FeedDraftSnapshot;
}

/** Whole-draft replacement: restore and reset-from-feed. Locales absent from the snapshot are dropped. */
export const replaceFeedDraft = (
  db: DB,
  input: ReplaceFeedDraftInput
): Promise<FeedDraftWriteResult> =>
  db.transaction(async (tx) => {
    const locked = await lockOwnedDraft(tx, input);
    if (locked.status !== "locked") return locked;
    const current = locked.draft;

    const revision = current.revision + 1;
    const [row] = await tx
      .update(feedDrafts)
      .set({
        slug: input.snapshot.slug,
        type: input.snapshot.type,
        defaultLocale: input.snapshot.defaultLocale,
        mainImage: input.snapshot.mainImage,
        revision,
        updatedAt: new Date(),
      })
      .where(eq(feedDrafts.id, input.draftId))
      .returning();
    if (!row)
      throw new Error(`Updating draft ${input.draftId} returned no row.`);
    await tx
      .delete(feedDraftTranslations)
      .where(eq(feedDraftTranslations.draftId, input.draftId));
    const translations = Object.entries(input.snapshot.translations);
    const written =
      translations.length > 0
        ? await tx
            .insert(feedDraftTranslations)
            .values(
              translations.map(([locale, translation]) => ({
                draftId: input.draftId,
                locale:
                  /* SAFETY: snapshot translations are keyed by Locale. */ locale as Locale,
                ...translation,
              }))
            )
            .returning()
        : [];

    const draft = toRecord(row, translationsOf(written));
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

/** Newest first, only under one of `userId`'s drafts; anyone else's draft lists nothing. */
export const listFeedDraftRevisions = async (
  db: DB,
  input: { draftId: number; limit: number; userId: string }
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
    .innerJoin(feedDrafts, eq(feedDrafts.id, feedDraftRevisions.draftId))
    .where(
      and(
        eq(feedDraftRevisions.draftId, input.draftId),
        eq(feedDrafts.userId, input.userId)
      )
    )
    .orderBy(desc(feedDraftRevisions.revision))
    .limit(input.limit);

/** A revision of one of `userId`'s drafts; a revision under anyone else's draft reads as null. */
export const getFeedDraftRevision = async (
  db: DB,
  input: { draftId: number; revisionId: number; userId: string }
): Promise<FeedDraftRevision | null> => {
  const [row] = await db
    .select({ revision: feedDraftRevisions })
    .from(feedDraftRevisions)
    .innerJoin(feedDrafts, eq(feedDrafts.id, feedDraftRevisions.draftId))
    .where(
      and(
        eq(feedDraftRevisions.draftId, input.draftId),
        eq(feedDraftRevisions.id, input.revisionId),
        eq(feedDrafts.userId, input.userId)
      )
    );
  return row?.revision ?? null;
};

/** Operator revisions above `afterRevision` on one of `userId`'s drafts, oldest first, for the agent's turn context. */
export const listOperatorFeedDraftChanges = async (
  db: DB,
  input: { draftId: number; afterRevision: number; userId: string }
): Promise<FeedDraftChange[]> => {
  const rows = await db
    .select({ changes: feedDraftRevisions.changes })
    .from(feedDraftRevisions)
    .innerJoin(feedDrafts, eq(feedDrafts.id, feedDraftRevisions.draftId))
    .where(
      and(
        eq(feedDraftRevisions.draftId, input.draftId),
        eq(feedDrafts.userId, input.userId),
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

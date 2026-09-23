import {
  and,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lt,
  lte,
  or,
  sql,
} from "drizzle-orm";

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
  FeedDraftRevisionKind,
  FeedDraftSnapshot,
  FeedDraftTranslationSnapshot,
  Locale,
} from "../../schemas/schema.ts";
import {
  FEED_DRAFT_AUTHOR,
  FEED_DRAFT_REVISION_KIND,
  feedDraftRevisions,
  feedDrafts,
  feedDraftTranslations,
} from "../../schemas/schema.ts";

import { hashFeedDraftSnapshot } from "./hash.ts";
import { FEED_DRAFT_CHANNEL } from "./notice.ts";
import type { FeedDraftNotice } from "./notice.ts";
import {
  META_FIELDS,
  TRANSLATION_FIELDS,
  definedKeys,
  settleFeedDraftPatch,
} from "./patch.ts";
import type {
  FeedDraftRejectedChange,
  GuardedFeedDraftFields,
} from "./patch.ts";

/**
 * `feed_draft` with its translations, snapshot trail and compare-and-set writes. Every write
 * runs in one transaction that locks the draft row, so two writers cannot interleave.
 */

export type { FeedDraftSnapshot, FeedDraftTranslationSnapshot };

export interface FeedDraftRecord extends FeedDraftSnapshot {
  id: number;
  feedId: number | null;
  userId: string;
  revision: number;
  contentHash: string;
  appliedRevisionId: number | null;
  /** `contentHash` of the applied commit; unapplied work is a `contentHash` that differs. */
  appliedHash: string | null;
  lastAuthor: FeedDraftAuthor;
  lastSessionId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeedDraftWriter {
  author: FeedDraftAuthor;
  sessionId?: string | null;
}

export type FeedDraftWriteResult =
  | { status: "ok"; draft: FeedDraftRecord }
  /**
   * The draft is not what the caller wrote against: its revision or hash, or the fields in
   * `rejected`. Nothing was written; `draft` is the current state so the caller can rebase.
   */
  | {
      status: "conflict";
      draft: FeedDraftRecord;
      rejected?: FeedDraftRejectedChange[];
    }
  | { status: "not_found" };

/** While one writer keeps writing, a safety point is kept this often. */
const SAFETY_POINT_INTERVAL_MS = 10 * 60 * 1000;
/** Unpinned safety points kept per draft; older ones are pruned when one is added. */
const MAX_SAFETY_POINTS_PER_DRAFT = 100;

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
  translations: FeedDraftRecord["translations"],
  appliedHash: string | null
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
    contentHash: draft.contentHash,
    appliedRevisionId: draft.appliedRevisionId,
    appliedHash,
    lastAuthor: draft.lastAuthor,
    lastSessionId: draft.lastSessionId,
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

/** Correlated to the `feed_draft` row being selected. */
const appliedHashOf = sql<
  string | null
>`(select ${feedDraftRevisions.contentHash} from ${feedDraftRevisions} where ${feedDraftRevisions.id} = ${feedDrafts.appliedRevisionId})`;

const readDraft = async (
  db: DB | Tx,
  draftId: number,
  options: { lock?: boolean; userId?: string } = {}
): Promise<FeedDraftRecord | null> => {
  const query = db
    .select({ draft: feedDrafts, appliedHash: appliedHashOf })
    .from(feedDrafts)
    .where(
      options.userId === undefined
        ? eq(feedDrafts.id, draftId)
        : and(eq(feedDrafts.id, draftId), eq(feedDrafts.userId, options.userId))
    );
  const [row] = options.lock ? await query.for("update") : await query;
  if (!row) return null;
  const rows = await db
    .select()
    .from(feedDraftTranslations)
    .where(eq(feedDraftTranslations.draftId, draftId));
  return toRecord(row.draft, translationsOf(rows), row.appliedHash);
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
      appliedRevisionId: feedDrafts.appliedRevisionId,
    })
    .from(feedDrafts)
    .where(eq(feedDrafts.id, draftId));
  return draft ?? null;
};

interface SelectedDraft {
  draft: typeof feedDrafts.$inferSelect;
  appliedHash: string | null;
}

const readDraftTranslations = async (
  db: DB,
  drafts: SelectedDraft[]
): Promise<FeedDraftRecord[]> => {
  if (drafts.length === 0) return [];
  const rows = await db
    .select()
    .from(feedDraftTranslations)
    .where(
      inArray(
        feedDraftTranslations.draftId,
        drafts.map(({ draft }) => draft.id)
      )
    );
  const translations = new Map<number, typeof rows>();
  for (const row of rows) {
    const group = translations.get(row.draftId) ?? [];
    group.push(row);
    translations.set(row.draftId, group);
  }
  return drafts.map(({ draft, appliedHash }) =>
    toRecord(
      draft,
      translationsOf(translations.get(draft.id) ?? []),
      appliedHash
    )
  );
};

/** Reads a session's drafts in the requested order, omitting discarded rows. */
export const getFeedDrafts = async (db: DB, draftIds: readonly number[]) => {
  if (draftIds.length === 0) return [];
  const drafts = await db
    .select({ draft: feedDrafts, appliedHash: appliedHashOf })
    .from(feedDrafts)
    .where(inArray(feedDrafts.id, [...draftIds]));
  const byId = new Map(drafts.map((row) => [row.draft.id, row]));
  return readDraftTranslations(
    db,
    draftIds.flatMap((id) => {
      const row = byId.get(id);
      return row ? [row] : [];
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
 * Drafts the operator still has work in: never applied, or holding content the applied commit
 * does not.
 */
export const listOpenFeedDrafts = async (
  db: DB,
  userId: string
): Promise<FeedDraftListItem[]> => {
  const drafts = await db
    .select({ draft: feedDrafts, appliedHash: appliedHashOf })
    .from(feedDrafts)
    .where(
      and(
        eq(feedDrafts.userId, userId),
        or(
          isNull(feedDrafts.appliedRevisionId),
          sql`${feedDrafts.contentHash} <> ${appliedHashOf}`
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
        drafts.map(({ draft }) => draft.id)
      )
    );
  const byDraft = new Map<number, FeedDraftListItem["translations"]>();
  for (const row of titles) {
    const translations = byDraft.get(row.draftId) ?? {};
    translations[row.locale] = { title: row.title };
    byDraft.set(row.draftId, translations);
  }
  return drafts.map(({ draft, appliedHash }) => ({
    ...toRecord(draft, {}, appliedHash),
    translations: byDraft.get(draft.id) ?? {},
  }));
};

/** Fields that differ between two snapshots; `before` absent reads as every field of `after`. */
export const diffFeedDraftSnapshots = (
  before: FeedDraftSnapshot | null,
  after: FeedDraftSnapshot
): FeedDraftChange[] => {
  const changes: FeedDraftChange[] = [];
  const metaFields = META_FIELDS.filter(
    (field) => !before || before[field] !== after[field]
  );
  if (metaFields.length > 0) changes.push({ fields: metaFields });

  // SAFETY: snapshot translations are keyed by Locale.
  const locales = [
    ...new Set([
      ...Object.keys(before?.translations ?? {}),
      ...Object.keys(after.translations),
    ]),
  ] as Locale[];
  for (const locale of locales) {
    const previous = before?.translations[locale];
    const next = after.translations[locale];
    const fields = TRANSLATION_FIELDS.filter(
      (field) => (previous?.[field] ?? null) !== (next?.[field] ?? null)
    );
    if (fields.length > 0 || !previous !== !next) {
      changes.push({
        locale,
        fields: fields.length > 0 ? fields : [...TRANSLATION_FIELDS],
      });
    }
  }
  return changes;
};

const latestRevision = async (tx: Tx, draftId: number) => {
  const [latest] = await tx
    .select()
    .from(feedDraftRevisions)
    .where(eq(feedDraftRevisions.draftId, draftId))
    .orderBy(desc(feedDraftRevisions.revision), desc(feedDraftRevisions.id))
    .limit(1);
  return latest ?? null;
};

/** Snapshots `draft` as it stands, attributed to whoever last wrote it. */
const recordRevision = async (
  tx: Tx,
  draft: FeedDraftRecord,
  input: {
    kind: FeedDraftRevisionKind;
    message?: string | null;
    latest: FeedDraftRevision | null;
  }
) => {
  const snapshot = snapshotOf(draft);
  const [row] = await tx
    .insert(feedDraftRevisions)
    .values({
      draftId: draft.id,
      kind: input.kind,
      revision: draft.revision,
      author: draft.lastAuthor,
      sessionId: draft.lastSessionId,
      message: input.message ?? null,
      changes: diffFeedDraftSnapshots(input.latest?.snapshot ?? null, snapshot),
      snapshot,
      contentHash: draft.contentHash,
    })
    .returning();
  if (!row) throw new Error(`Recording draft ${draft.id} returned no row.`);
  return row;
};

/**
 * Whether the state a write is about to replace must be kept first: nothing holds it yet, and
 * either the writer changes hands or the last row is older than
 * {@link SAFETY_POINT_INTERVAL_MS}. `force` is for writes that replace the whole draft.
 */
export const needsSafetyPoint = (input: {
  current: Pick<FeedDraftRecord, "revision" | "lastAuthor" | "lastSessionId">;
  latest: Pick<FeedDraftRevision, "revision" | "createdAt"> | null;
  writer: FeedDraftWriter;
  now: number;
  force?: boolean;
}): boolean => {
  if (input.latest?.revision === input.current.revision) return false;
  if (input.force || !input.latest) return true;
  const handoff =
    input.current.lastAuthor !== input.writer.author ||
    input.current.lastSessionId !== (input.writer.sessionId ?? null);
  return (
    handoff ||
    input.now - input.latest.createdAt.getTime() >= SAFETY_POINT_INTERVAL_MS
  );
};

/** Keeps `current` when {@link needsSafetyPoint} says so. The newest state is never kept here: it is the draft. */
const keepSafetyPoint = async (
  tx: Tx,
  current: FeedDraftRecord,
  writer: FeedDraftWriter,
  options: { force?: boolean } = {}
) => {
  const latest = await latestRevision(tx, current.id);
  if (
    !needsSafetyPoint({
      current,
      latest,
      writer,
      now: Date.now(),
      force: options.force,
    })
  )
    return;

  await recordRevision(tx, current, {
    kind: FEED_DRAFT_REVISION_KIND.Safety,
    latest,
  });
  await tx.delete(feedDraftRevisions).where(
    and(
      eq(feedDraftRevisions.draftId, current.id),
      eq(feedDraftRevisions.kind, FEED_DRAFT_REVISION_KIND.Safety),
      eq(feedDraftRevisions.pinned, false),
      sql`${feedDraftRevisions.id} not in (
        select id from ${feedDraftRevisions}
        where ${feedDraftRevisions.draftId} = ${current.id}
          and ${feedDraftRevisions.kind} = ${FEED_DRAFT_REVISION_KIND.Safety}
          and ${feedDraftRevisions.pinned} = false
        order by ${feedDraftRevisions.id} desc
        limit ${MAX_SAFETY_POINTS_PER_DRAFT}
      )`
    )
  );
};

export interface CreateFeedDraftInput extends FeedDraftWriter {
  userId: string;
  feedId?: number | null;
  snapshot?: Partial<FeedDraftSnapshot>;
  /** Set when the draft is opened from an existing feed: its first state is the commit the feed holds. */
  applied?: boolean;
}

export const createFeedDraft = (
  db: DB,
  input: CreateFeedDraftInput
): Promise<FeedDraftRecord> =>
  db.transaction(async (tx) => {
    const snapshot: FeedDraftSnapshot = {
      slug: input.snapshot?.slug ?? null,
      type: input.snapshot?.type ?? "post",
      defaultLocale: input.snapshot?.defaultLocale ?? "zh-TW",
      mainImage: input.snapshot?.mainImage ?? null,
      translations: input.snapshot?.translations ?? {},
    };
    const [draft] = await tx
      .insert(feedDrafts)
      .values({
        userId: input.userId,
        feedId: input.feedId ?? null,
        slug: snapshot.slug,
        type: snapshot.type,
        defaultLocale: snapshot.defaultLocale,
        mainImage: snapshot.mainImage,
        revision: 1,
        contentHash: hashFeedDraftSnapshot(snapshot),
        lastAuthor: input.author,
        lastSessionId: input.sessionId ?? null,
      })
      .returning();
    if (!draft) throw new Error("Creating the draft returned no row.");

    const translations = Object.entries(snapshot.translations);
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
    if (!input.applied) {
      await recordRevision(tx, record, {
        kind: FEED_DRAFT_REVISION_KIND.Safety,
        latest: null,
      });
      return record;
    }
    const commit = await recordRevision(tx, record, {
      kind: FEED_DRAFT_REVISION_KIND.Commit,
      message: "Opened from the post",
      latest: null,
    });
    await tx
      .update(feedDrafts)
      .set({ appliedRevisionId: commit.id })
      .where(eq(feedDrafts.id, draft.id));
    return {
      ...record,
      appliedRevisionId: commit.id,
      appliedHash: commit.contentHash,
    };
  });

/** Who is writing. A draft another user owns answers `not_found`, checked on the locked row. */
export interface FeedDraftOwnedWrite extends FeedDraftWriter {
  draftId: number;
  userId: string;
  /** Omit to write over whatever is current. */
  expectedRevision?: number;
  /** The content the caller decided on; a draft holding anything else is a conflict. */
  expectedHash?: string;
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
    (input.expectedRevision !== undefined &&
      input.expectedRevision !== current.revision) ||
    (input.expectedHash !== undefined &&
      input.expectedHash !== current.contentHash)
  ) {
    return { status: "conflict", draft: current };
  }
  return { status: "locked", draft: current };
};

export interface PatchFeedDraftInput
  extends FeedDraftOwnedWrite, GuardedFeedDraftFields {}

export const patchFeedDraft = (
  db: DB,
  input: PatchFeedDraftInput
): Promise<FeedDraftWriteResult> =>
  db.transaction(async (tx) => {
    const locked = await lockOwnedDraft(tx, input);
    if (locked.status !== "locked") return locked;
    const settled = settleFeedDraftPatch(snapshotOf(locked.draft), input);
    if (!settled.ok) {
      return {
        status: "conflict",
        draft: locked.draft,
        rejected: settled.rejected,
      };
    }
    return {
      status: "ok",
      draft: await writePatch(tx, locked.draft, {
        author: input.author,
        sessionId: input.sessionId,
        ...settled.fields,
      }),
    };
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

  await keepSafetyPoint(tx, current, input);

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

  const [row] = await tx
    .update(feedDrafts)
    .set({
      ...(input.meta ?? {}),
      revision: current.revision + 1,
      contentHash: hashFeedDraftSnapshot({
        ...snapshotOf(current),
        ...(input.meta ?? {}),
        translations,
      }),
      lastAuthor: input.author,
      lastSessionId: input.sessionId ?? null,
      updatedAt: new Date(),
    })
    .where(eq(feedDrafts.id, current.id))
    .returning();
  if (!row) throw new Error(`Updating draft ${current.id} returned no row.`);

  const draft = toRecord(row, translations, current.appliedHash);
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

    await keepSafetyPoint(tx, current, input, { force: true });

    const revision = current.revision + 1;
    const [row] = await tx
      .update(feedDrafts)
      .set({
        slug: input.snapshot.slug,
        type: input.snapshot.type,
        defaultLocale: input.snapshot.defaultLocale,
        mainImage: input.snapshot.mainImage,
        revision,
        contentHash: hashFeedDraftSnapshot(input.snapshot),
        lastAuthor: input.author,
        lastSessionId: input.sessionId ?? null,
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

    const draft = toRecord(row, translationsOf(written), current.appliedHash);
    const changes = diffFeedDraftSnapshots(
      snapshotOf(current),
      snapshotOf(draft)
    );
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

const describeChanges = (changes: FeedDraftChange[]): string =>
  changes
    .map((change) =>
      change.locale
        ? `${change.locale}: ${change.fields.join(", ")}`
        : change.fields.join(", ")
    )
    .join(" · ");

/**
 * Commits the locked draft as the version `feed` now holds: an immutable row and the draft's
 * applied pointer in one step. Without a `message`, one is made from what changed since the
 * commit before. The caller wrote the feed in this same transaction.
 */
export const commitFeedDraft = (
  db: DB,
  input: { draft: FeedDraftRecord; feedId: number; message?: string | null }
): Promise<FeedDraftRevision> =>
  db.transaction(async (tx) => {
    const { draft } = input;
    const [previous] =
      draft.appliedRevisionId === null
        ? []
        : await tx
            .select({ snapshot: feedDraftRevisions.snapshot })
            .from(feedDraftRevisions)
            .where(eq(feedDraftRevisions.id, draft.appliedRevisionId));
    const message =
      input.message?.trim() ||
      (previous
        ? describeChanges(
            diffFeedDraftSnapshots(previous.snapshot, snapshotOf(draft))
          ) || "No changes"
        : "First version");

    const commit = await recordRevision(tx, draft, {
      kind: FEED_DRAFT_REVISION_KIND.Commit,
      message,
      latest: await latestRevision(tx, draft.id),
    });
    await tx
      .update(feedDrafts)
      .set({ feedId: input.feedId, appliedRevisionId: commit.id })
      .where(eq(feedDrafts.id, draft.id));
    await notifyFeedDraft(tx, {
      type: "applied",
      draftId: draft.id,
      revision: draft.revision,
      feedId: input.feedId,
    });
    return commit;
  });

export type DeleteFeedDraftResult =
  | { status: "deleted" }
  /** The draft no longer holds `expectedHash`; `draft` is what it holds now. */
  | { status: "conflict"; draft: FeedDraftRecord }
  /** The draft got a post since the caller looked; discarding it means restoring, not deleting. */
  | { status: "bound"; draft: FeedDraftRecord }
  | { status: "not_found" };

/**
 * Deletes a draft that has no post, under its row lock so the content checked is the content
 * deleted: a write that lands between the caller's read and the delete is a conflict.
 */
export const deleteUnboundFeedDraft = (
  db: DB,
  input: { draftId: number; userId: string; expectedHash: string }
): Promise<DeleteFeedDraftResult> =>
  db.transaction(async (tx) => {
    const current = await readDraft(tx, input.draftId, {
      lock: true,
      userId: input.userId,
    });
    if (!current) return { status: "not_found" };
    if (current.contentHash !== input.expectedHash) {
      return { status: "conflict", draft: current };
    }
    if (current.feedId !== null) return { status: "bound", draft: current };
    await tx.delete(feedDrafts).where(eq(feedDrafts.id, current.id));
    await notifyFeedDraft(tx, { type: "discarded", draftId: current.id });
    return { status: "deleted" };
  });

export type FeedDraftRevisionSummary = Omit<FeedDraftRevision, "snapshot">;

/** Newest first, only under one of `userId`'s drafts; anyone else's draft lists nothing. */
export const listFeedDraftRevisions = async (
  db: DB,
  input: {
    draftId: number;
    limit: number;
    userId: string;
    kind?: FeedDraftRevisionKind;
  }
): Promise<FeedDraftRevisionSummary[]> =>
  await db
    .select({
      id: feedDraftRevisions.id,
      draftId: feedDraftRevisions.draftId,
      revision: feedDraftRevisions.revision,
      author: feedDraftRevisions.author,
      kind: feedDraftRevisions.kind,
      sessionId: feedDraftRevisions.sessionId,
      message: feedDraftRevisions.message,
      pinned: feedDraftRevisions.pinned,
      changes: feedDraftRevisions.changes,
      contentHash: feedDraftRevisions.contentHash,
      createdAt: feedDraftRevisions.createdAt,
      updatedAt: feedDraftRevisions.updatedAt,
    })
    .from(feedDraftRevisions)
    .innerJoin(feedDrafts, eq(feedDrafts.id, feedDraftRevisions.draftId))
    .where(
      and(
        eq(feedDraftRevisions.draftId, input.draftId),
        eq(feedDrafts.userId, input.userId),
        input.kind ? eq(feedDraftRevisions.kind, input.kind) : undefined
      )
    )
    .orderBy(desc(feedDraftRevisions.revision), desc(feedDraftRevisions.id))
    .limit(input.limit);

/**
 * The state a row is read against: the commit before a commit, which is what its message
 * describes, and the row before a safety point, which is what its `changes` name. `null` for
 * the first of its kind.
 */
export const getFeedDraftRevisionBase = async (
  db: DB,
  revision: Pick<FeedDraftRevision, "id" | "draftId" | "revision" | "kind">
): Promise<FeedDraftRevision | null> => {
  const [base] = await db
    .select()
    .from(feedDraftRevisions)
    .where(
      and(
        eq(feedDraftRevisions.draftId, revision.draftId),
        or(
          lt(feedDraftRevisions.revision, revision.revision),
          and(
            eq(feedDraftRevisions.revision, revision.revision),
            lt(feedDraftRevisions.id, revision.id)
          )
        ),
        revision.kind === FEED_DRAFT_REVISION_KIND.Commit
          ? eq(feedDraftRevisions.kind, FEED_DRAFT_REVISION_KIND.Commit)
          : undefined
      )
    )
    .orderBy(desc(feedDraftRevisions.revision), desc(feedDraftRevisions.id))
    .limit(1);
  return base ?? null;
};

/**
 * Keeps a safety point of one of `userId`'s drafts out of pruning, or lets it go again; `label`
 * names it. A commit is never pruned, so it answers null like a row that is not there.
 */
export const pinFeedDraftRevision = async (
  db: DB,
  input: {
    draftId: number;
    revisionId: number;
    userId: string;
    pinned: boolean;
    label?: string | null;
  }
): Promise<FeedDraftRevisionSummary | null> => {
  const [row] = await db
    .update(feedDraftRevisions)
    // Drizzle leaves an `undefined` column alone, so an omitted label keeps the name.
    .set({ pinned: input.pinned, message: input.label })
    .where(
      and(
        eq(feedDraftRevisions.id, input.revisionId),
        eq(feedDraftRevisions.kind, FEED_DRAFT_REVISION_KIND.Safety),
        inArray(
          feedDraftRevisions.draftId,
          db
            .select({ id: feedDrafts.id })
            .from(feedDrafts)
            .where(
              and(
                eq(feedDrafts.id, input.draftId),
                eq(feedDrafts.userId, input.userId)
              )
            )
        )
      )
    )
    .returning();
  if (!row) return null;
  const { snapshot: _snapshot, ...summary } = row;
  return summary;
};

/** A state on the trail: a kept row, or the draft itself as the newest entry. */
export interface FeedDraftTrailEntry {
  revision: number;
  author: FeedDraftAuthor;
  sessionId: string | null;
  snapshot: FeedDraftSnapshot;
}

/**
 * States kept after `after`, oldest first, then the draft as it stands when nothing holds it
 * yet, all preceded by the newest state kept before so the first change has a baseline. Each
 * entry differs from the one before it by its own `author`'s writes only. `after` null reads
 * the whole trail. Writes newer than the baseline but older than `after` are read again
 * rather than lost.
 */
export const listFeedDraftTrailSince = async (
  db: DB,
  input: { draftId: number; userId: string; after: Date | null }
): Promise<FeedDraftTrailEntry[]> => {
  const draft = await readDraft(db, input.draftId, { userId: input.userId });
  if (!draft) return [];

  const since = await db
    .select()
    .from(feedDraftRevisions)
    .where(
      and(
        eq(feedDraftRevisions.draftId, input.draftId),
        input.after ? gt(feedDraftRevisions.createdAt, input.after) : undefined
      )
    )
    .orderBy(feedDraftRevisions.revision, feedDraftRevisions.id);
  const [baseline] = input.after
    ? await db
        .select()
        .from(feedDraftRevisions)
        .where(
          and(
            eq(feedDraftRevisions.draftId, input.draftId),
            lte(feedDraftRevisions.createdAt, input.after)
          )
        )
        .orderBy(desc(feedDraftRevisions.revision), desc(feedDraftRevisions.id))
        .limit(1)
    : [];

  const kept = [...(baseline ? [baseline] : []), ...since];
  const entries: FeedDraftTrailEntry[] = kept.map((row) => ({
    revision: row.revision,
    author: row.author,
    sessionId: row.sessionId,
    snapshot: row.snapshot,
  }));
  if ((kept.at(-1)?.revision ?? 0) < draft.revision) {
    entries.push({
      revision: draft.revision,
      author: draft.lastAuthor,
      sessionId: draft.lastSessionId,
      snapshot: snapshotOf(draft),
    });
  }
  return entries;
};

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

const mergeChanges = (
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

/**
 * Fields of one of `userId`'s drafts that writers other than `exceptSessionId` changed since
 * the newest state kept at or before `afterRevision`, for the agent's turn context. A writer
 * changing hands keeps the state it takes over, so each step along the trail has one author
 * and the session's own writes drop out exactly.
 */
export const listFeedDraftChangesSince = async (
  db: DB,
  input: {
    draftId: number;
    afterRevision: number;
    userId: string;
    exceptSessionId?: string;
  }
): Promise<FeedDraftChange[]> => {
  const draft = await readDraft(db, input.draftId, { userId: input.userId });
  if (!draft || draft.revision <= input.afterRevision) return [];
  const [baseline] = await db
    .select()
    .from(feedDraftRevisions)
    .where(
      and(
        eq(feedDraftRevisions.draftId, input.draftId),
        lte(feedDraftRevisions.revision, input.afterRevision)
      )
    )
    .orderBy(desc(feedDraftRevisions.revision), desc(feedDraftRevisions.id))
    .limit(1);
  const since = await db
    .select()
    .from(feedDraftRevisions)
    .where(
      and(
        eq(feedDraftRevisions.draftId, input.draftId),
        gt(feedDraftRevisions.revision, input.afterRevision)
      )
    )
    .orderBy(feedDraftRevisions.revision, feedDraftRevisions.id);

  const trail: FeedDraftTrailEntry[] = [
    ...(baseline ? [baseline] : []),
    ...since,
  ];
  if ((trail.at(-1)?.revision ?? 0) < draft.revision) {
    trail.push({
      revision: draft.revision,
      author: draft.lastAuthor,
      sessionId: draft.lastSessionId,
      snapshot: snapshotOf(draft),
    });
  }

  let changes: FeedDraftChange[] = [];
  for (let index = 1; index < trail.length; index += 1) {
    const entry = trail[index]!;
    if (
      entry.author === FEED_DRAFT_AUTHOR.Agent &&
      entry.sessionId === input.exceptSessionId
    ) {
      continue;
    }
    changes = mergeChanges(
      changes,
      diffFeedDraftSnapshots(trail[index - 1]!.snapshot, entry.snapshot)
    );
  }
  return changes;
};

export const snapshotOfRevision = (revision: FeedDraftRevision) =>
  revision.snapshot;

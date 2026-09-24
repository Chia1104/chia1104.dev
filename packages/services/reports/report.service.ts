import type { DB } from "@chia/db/client";
import {
  getFeedReportRecord,
  setFeedReportStatus,
} from "@chia/db/repos/feed-reports";
import type { FeedReportRecord } from "@chia/db/repos/feed-reports";
import { FeedDraftAuthor, FeedReportStatus } from "@chia/db/schema";
import type { Locale } from "@chia/db/types";
import { AppError, AppErrorCode } from "@chia/service-kit/errors";
import { feedUrl } from "@chia/utils/config";

import {
  openFeedDraftService,
  patchFeedDraftService,
} from "../feeds/draft.service";

export const toFeedReportView = (record: FeedReportRecord) => ({
  ...record,
  post: {
    ...record.post,
    url: feedUrl({
      type: record.post.type,
      slug: record.post.slug,
      locale: record.locale,
    }),
  },
});

export const requireFeedReport = async (
  db: DB,
  id: number
): Promise<FeedReportRecord> => {
  const record = await getFeedReportRecord(db, id);
  if (!record) {
    throw new AppError(AppErrorCode.NotFound, {
      message: `Report ${id} not found`,
    });
  }
  return record;
};

/**
 * Writes every suggested edit into the post's draft in one guarded patch, as the operator,
 * then marks the report in progress so applying the draft resolves it. A suggestion matched
 * the published body when triaged; one the draft has since moved away from fails the patch.
 * All of it is one transaction, so the draft never carries a fix the report does not know of.
 */
export const applyReportEditsService = async (
  db: DB,
  input: { id: number; adminId: string }
): Promise<{ record: FeedReportRecord; draftId: number }> =>
  db.transaction(async (tx) => {
    const record = await requireFeedReport(tx, input.id);
    if (
      record.status !== FeedReportStatus.Open &&
      record.status !== FeedReportStatus.InProgress
    ) {
      throw new AppError(AppErrorCode.BadRequest, {
        message: `Report ${input.id} is ${record.status}; reopen it first.`,
      });
    }
    const edits = record.triage?.edits ?? [];
    if (edits.length === 0) {
      throw new AppError(AppErrorCode.BadRequest, {
        message: `Report ${input.id} has no suggested edits.`,
      });
    }

    const draft = await openFeedDraftService(tx, {
      adminId: input.adminId,
      feedId: record.feedId,
      author: FeedDraftAuthor.Operator,
    });
    const byLocale: Partial<
      Record<Locale, { oldString: string; newString: string }[]>
    > = {};
    for (const edit of edits) {
      (byLocale[edit.locale] ??= []).push({
        oldString: edit.find,
        newString: edit.replace,
      });
    }
    await patchFeedDraftService(tx, {
      draftId: draft.id,
      adminId: input.adminId,
      expectedRevision: draft.revision,
      author: FeedDraftAuthor.Operator,
      edits: byLocale,
    });

    await setFeedReportStatus(tx, input.id, FeedReportStatus.InProgress);
    return {
      record: await requireFeedReport(tx, input.id),
      draftId: draft.id,
    };
  });

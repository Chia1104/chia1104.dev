import type { DB } from "@chia/db/client";
import {
  getFeedReportRecord,
  setFeedReportStatus,
} from "@chia/db/repos/feed-reports";
import type { FeedReportRecord } from "@chia/db/repos/feed-reports";
import { FEED_DRAFT_AUTHOR, FEED_REPORT_STATUS } from "@chia/db/schema";
import type { Locale } from "@chia/db/types";
import { AppError } from "@chia/service-kit/errors";
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
    throw new AppError("NOT_FOUND", { message: `Report ${id} not found` });
  }
  return record;
};

/**
 * Writes every suggested edit into the post's draft in one guarded patch, as the operator,
 * then marks the report in progress so applying the draft resolves it. A suggestion matched
 * the published body when triaged; one the draft has since moved away from fails the patch.
 */
export const applyReportEditsService = async (
  db: DB,
  input: { id: number; adminId: string }
): Promise<{ record: FeedReportRecord; draftId: number }> => {
  const record = await requireFeedReport(db, input.id);
  const edits = record.triage?.edits ?? [];
  if (edits.length === 0) {
    throw new AppError("BAD_REQUEST", {
      message: `Report ${input.id} has no suggested edits.`,
    });
  }

  const draft = await openFeedDraftService(db, {
    adminId: input.adminId,
    feedId: record.feedId,
    author: FEED_DRAFT_AUTHOR.Operator,
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
  await patchFeedDraftService(db, {
    draftId: draft.id,
    adminId: input.adminId,
    expectedRevision: draft.revision,
    author: FEED_DRAFT_AUTHOR.Operator,
    edits: byLocale,
  });

  await setFeedReportStatus(db, input.id, FEED_REPORT_STATUS.InProgress);
  return {
    record: await requireFeedReport(db, input.id),
    draftId: draft.id,
  };
};

import { ApiKeyScope } from "@chia/auth/apikey";
import { CallerTier } from "@chia/auth/tier";
import { listWritingSessionIdsForDraft } from "@chia/db/repos/agent";
import {
  getFeedDraftRevision,
  getFeedDraftRevisionBase,
  listFeedDraftRevisions,
  pinFeedDraftRevision,
  listOpenFeedDrafts,
} from "@chia/db/repos/drafts";
import type {
  FeedDraftRecord,
  FeedDraftRevisionSummary,
} from "@chia/db/repos/drafts";
import {
  getFeedById,
  getFeedBySlug,
  getFeedForIndexing,
  getInfiniteFeedsByUserId,
  deleteFeed,
  restoreFeed,
  softDeleteFeed,
} from "@chia/db/repos/feeds";
import { FeedDraftAuthor } from "@chia/db/schema";
import { reportError } from "@chia/observability/report";
import { withORPCErrors } from "@chia/service-kit/adapters/orpc";
import { feedSummaryOutputSchema } from "@chia/workflow-control/contract";

import { ResourceSearchMode } from "../rag/resource-types";
import { contractOS } from "../shared/context";
import { sessionGuard } from "../shared/guards/auth.guard";
import { callerGuard } from "../shared/guards/caller.guard";
import { rateLimitGuard } from "../shared/guards/rate-limit.guard";

import {
  resolveFeedLimit,
  resolveFeedVisibility,
  toFeedDetailScope,
  toFeedListScope,
} from "./access";
import { watchFeedDraft } from "./draft-watch.service";
import {
  applyFeedDraftService,
  discardFeedDraftService,
  editFeedDraftContentService,
  getFeedDraftService,
  openFeedDraftService,
  patchFeedDraftService,
  restoreFeedDraftRevisionService,
} from "./draft.service";
import {
  getRelatedFeedsService,
  searchFeedsService,
  searchPublicFeedsService,
} from "./search.service";
import { updateFeedService } from "./write.service";

// `publicReadGuard` has no floor: a browser never holds an API key, but one that is sent must
// still carry `feeds:read`. `keyedReadGuard` is www's server client with `x-ch-api-key`.
// `sessionReadGuard` is dash with a session cookie. Rate limit scales with the same tier.

const publicReadGuard = callerGuard({ scopes: [ApiKeyScope.FeedsRead] });
const keyedReadGuard = callerGuard({
  minTier: CallerTier.ApiKey,
  scopes: [ApiKeyScope.FeedsRead],
});
const sessionReadGuard = callerGuard({ minTier: CallerTier.Session });
const readRateLimit = rateLimitGuard("feeds");

export const getFeedsRoute = contractOS.feeds.list
  .use(publicReadGuard)
  .use(readRateLimit)
  .handler(async (opts) => {
    const { caller } = opts.context;
    const visibility = resolveFeedVisibility(caller, opts.input);

    const data = await getInfiniteFeedsByUserId(opts.context.db, {
      type: opts.input.type,
      tagSlug: opts.input.tag,
      limit: resolveFeedLimit(caller.tier, opts.input.limit),
      orderBy: opts.input.orderBy,
      sortOrder: opts.input.sortOrder,
      cursor: opts.input.nextCursor,
      withContent: opts.input.withContent,
      locale: opts.input.locale,
      ...toFeedListScope(visibility),
    });

    if (!data) {
      throw opts.errors.NOT_FOUND();
    }

    return data;
  });

export const getFeedBySlugRoute = contractOS.feeds["details-by-slug"]
  .use(keyedReadGuard)
  .use(readRateLimit)
  .handler(async (opts) => {
    const visibility = resolveFeedVisibility(opts.context.caller, opts.input);

    const feed = await getFeedBySlug(opts.context.db, {
      slug: opts.input.slug,
      locale: opts.input.locale,
      ...toFeedDetailScope(visibility),
    });

    if (!feed) {
      throw opts.errors.NOT_FOUND();
    }

    return feed;
  });

export const getFeedByIdRoute = contractOS.feeds["details-by-id"]
  .use(sessionReadGuard)
  .use(readRateLimit)
  .handler(async (opts) => {
    const visibility = resolveFeedVisibility(opts.context.caller, opts.input);

    const feed = await getFeedById(opts.context.db, {
      feedId: opts.input.feedId,
      locale: opts.input.locale,
      ...toFeedDetailScope(visibility),
    });

    if (!feed) {
      throw opts.errors.NOT_FOUND();
    }

    return feed;
  });

export const getRelatedFeedsRoute = contractOS.feeds.related
  .use(keyedReadGuard)
  .use(readRateLimit)
  .handler(async (opts) => {
    const items = await getRelatedFeedsService({
      db: opts.context.db,
      kv: opts.context.kv,
      slug: opts.input.slug,
      locale: opts.input.locale,
      limit: opts.input.limit,
    });

    return { items };
  });

export const searchFeedsRoute = contractOS.feeds.search
  .use(publicReadGuard)
  .use(readRateLimit)
  .handler(async (opts) => {
    const items = await searchPublicFeedsService({
      db: opts.context.db,
      keyword: opts.input.keyword,
      locale: opts.input.locale,
      limit: opts.input.limit,
    });

    return { items };
  });

export const searchFeedsAdvancedRoute = contractOS.feeds["search:advanced"]
  /**
   * Authenticated for every mode; root-only for modes that embed the query. Those spend
   * the server's embedding credentials; `bm25` does not.
   */
  .use(
    sessionGuard.adaptInput((input) => ({
      rootOnly: input.model !== ResourceSearchMode.Bm25,
    }))
  )
  .handler(async (opts) => {
    const { keyword, model, locale } = opts.input;

    return await searchFeedsService({
      db: opts.context.db,
      keyword,
      model,
      locale,
    });
  });

// `update` sits at API-key so a script can publish or date a post; it cannot touch content,
// which changes only when a draft is applied. The rest require the operator's session.

const contentWriteGuard = callerGuard({
  minTier: CallerTier.ApiKey,
  scopes: [ApiKeyScope.FeedsWrite],
});
const rootWriteGuard = callerGuard({ minTier: CallerTier.Root });

export const updateFeedRoute = contractOS.feeds.update
  .use(contentWriteGuard)
  .handler((opts) =>
    withORPCErrors(() =>
      updateFeedService(opts.context.db, opts.input, opts.context.hooks ?? {})
    )
  );

export const deleteFeedRoute = contractOS.feeds.delete
  .use(rootWriteGuard)
  .handler(async (opts) => {
    const feed = await getFeedForIndexing(opts.context.db, {
      feedId: opts.input.feedId,
    });
    if (!feed) {
      throw opts.errors.NOT_FOUND();
    }

    if (opts.input.hard) {
      await deleteFeed(opts.context.db, { feedId: opts.input.feedId });
    } else {
      await softDeleteFeed(opts.context.db, { feedId: opts.input.feedId });
    }

    await opts.context.hooks?.onFeedRemoved?.(
      feed.translations.map(({ id }) => id)
    );
  });

export const restoreFeedRoute = contractOS.feeds.restore
  .use(rootWriteGuard)
  .handler(async (opts) => {
    const data = await restoreFeed(opts.context.db, {
      feedId: opts.input.feedId,
    });
    if (!data) {
      throw opts.errors.NOT_FOUND();
    }
    await opts.context.hooks?.onFeedChanged?.(data.id);
  });

export const summarizeFeedRoute = contractOS.feeds.summarize
  .use(rootWriteGuard)
  .handler(async (opts) => {
    const feed = await getFeedForIndexing(opts.context.db, {
      feedId: opts.input.feedId,
    });
    if (!feed || feed.deletedAt) {
      throw opts.errors.NOT_FOUND();
    }
    if (!feed.published) {
      throw opts.errors.BAD_REQUEST({
        message: "Only a published post is summarised. Publish it first.",
      });
    }
    const runId = await opts.context.workflow.startFeedSummary(feed.id);
    return { runId };
  });

export const getFeedSummaryRunRoute = contractOS.feeds["summarize:run"]
  .use(rootWriteGuard)
  .handler(async (opts) => {
    const run = await opts.context.workflow.getRun(opts.input.runId);
    if (!run.exists || !run.status) {
      throw opts.errors.NOT_FOUND();
    }
    // A run of another workflow, or one that threw, has no output of this shape.
    const output = feedSummaryOutputSchema.safeParse(run.output);
    return {
      status: run.status,
      output: output.success ? output.data : undefined,
    };
  });

// The working draft is the operator's; the agent reaches it through its own port, never here.

const toDraftOutput = <
  TDraft extends Pick<FeedDraftRecord, "createdAt" | "updatedAt">,
>(
  draft: TDraft
) => ({
  ...draft,
  createdAt: draft.createdAt.toISOString(),
  updatedAt: draft.updatedAt.toISOString(),
});

const toRevisionOutput = (revision: FeedDraftRevisionSummary) => ({
  id: revision.id,
  kind: revision.kind,
  revision: revision.revision,
  author: revision.author,
  sessionId: revision.sessionId,
  message: revision.message,
  pinned: revision.pinned,
  changes: revision.changes,
  contentHash: revision.contentHash,
  createdAt: revision.createdAt.toISOString(),
  updatedAt: revision.updatedAt.toISOString(),
});

export const openFeedDraftRoute = contractOS.feeds["draft:open"]
  .use(rootWriteGuard)
  .handler((opts) =>
    withORPCErrors(async () =>
      toDraftOutput(
        await openFeedDraftService(opts.context.db, {
          adminId: opts.context.caller.adminId,
          feedId: opts.input.feedId,
          author: FeedDraftAuthor.Operator,
        })
      )
    )
  );

export const getFeedDraftRoute = contractOS.feeds["draft:get"]
  .use(rootWriteGuard)
  .handler((opts) =>
    withORPCErrors(async () =>
      toDraftOutput(
        await getFeedDraftService(opts.context.db, {
          draftId: opts.input.draftId,
          adminId: opts.context.caller.adminId,
        })
      )
    )
  );

export const listFeedDraftsRoute = contractOS.feeds["draft:list"]
  .use(rootWriteGuard)
  .handler(async (opts) => ({
    items: (
      await listOpenFeedDrafts(opts.context.db, opts.context.caller.adminId)
    ).map(toDraftOutput),
  }));

export const patchFeedDraftRoute = contractOS.feeds["draft:patch"]
  .use(rootWriteGuard)
  .handler((opts) =>
    withORPCErrors(async () => {
      const { draftId, expectedRevision, base, edits, translations, ...meta } =
        opts.input;
      const { translations: baseTranslations, ...baseMeta } = base ?? {};
      return toDraftOutput(
        await patchFeedDraftService(opts.context.db, {
          draftId,
          adminId: opts.context.caller.adminId,
          expectedRevision,
          meta,
          translations,
          base: base && { meta: baseMeta, translations: baseTranslations },
          edits,
          author: FeedDraftAuthor.Operator,
        })
      );
    })
  );

export const editFeedDraftRoute = contractOS.feeds["draft:edit"]
  .use(rootWriteGuard)
  .handler((opts) =>
    withORPCErrors(async () => {
      const { draft, edits } = await editFeedDraftContentService(
        opts.context.db,
        {
          ...opts.input,
          adminId: opts.context.caller.adminId,
          author: FeedDraftAuthor.Operator,
        }
      );
      return {
        draftId: draft.id,
        locale: opts.input.locale,
        revision: draft.revision,
        replacements: edits.reduce((sum, edit) => sum + edit.replacements, 0),
        edits,
      };
    })
  );

/**
 * A commit by the operator is the strongest signal that a draft is how they want it, so every
 * writing session that worked on it extracts its lessons now. The agent's own commit goes
 * through its content port, and the host schedules that extraction itself.
 */
export const applyFeedDraftRoute = contractOS.feeds["draft:apply"]
  .use(rootWriteGuard)
  .handler((opts) =>
    withORPCErrors(async () => {
      const sessionIds = await listWritingSessionIdsForDraft(
        opts.context.db,
        opts.input.draftId
      );
      const result = await applyFeedDraftService(
        opts.context.db,
        {
          draftId: opts.input.draftId,
          adminId: opts.context.caller.adminId,
          expectedHash: opts.input.expectedHash,
          message: opts.input.message,
        },
        opts.context.hooks ?? {}
      );
      for (const sessionId of sessionIds) {
        try {
          await opts.context.workflow.startMemoryConsolidation(sessionId);
        } catch (cause) {
          reportError(cause, "Could not start lesson extraction after apply", {
            draftId: opts.input.draftId,
            sessionId,
          });
        }
      }
      return result;
    })
  );

export const discardFeedDraftRoute = contractOS.feeds["draft:discard"]
  .use(rootWriteGuard)
  .handler((opts) =>
    withORPCErrors(() =>
      discardFeedDraftService(opts.context.db, {
        draftId: opts.input.draftId,
        adminId: opts.context.caller.adminId,
        expectedHash: opts.input.expectedHash,
      })
    )
  );

export const listFeedDraftRevisionsRoute = contractOS.feeds["draft:revisions"]
  .use(rootWriteGuard)
  .handler((opts) =>
    withORPCErrors(async () => {
      const items = await listFeedDraftRevisions(opts.context.db, {
        draftId: opts.input.draftId,
        kind: opts.input.kind,
        limit: opts.input.limit,
        userId: opts.context.caller.adminId,
      });
      return { items: items.map(toRevisionOutput) };
    })
  );

export const getFeedDraftRevisionRoute = contractOS.feeds["draft:revision"]
  .use(rootWriteGuard)
  .handler(async (opts) => {
    const revision = await getFeedDraftRevision(opts.context.db, {
      ...opts.input,
      userId: opts.context.caller.adminId,
    });
    if (!revision) throw opts.errors.NOT_FOUND();
    const base = await getFeedDraftRevisionBase(opts.context.db, revision);
    return {
      ...toRevisionOutput(revision),
      snapshot: revision.snapshot,
      base: base?.snapshot ?? null,
    };
  });

export const pinFeedDraftRevisionRoute = contractOS.feeds["draft:pin"]
  .use(rootWriteGuard)
  .handler(async (opts) => {
    const revision = await pinFeedDraftRevision(opts.context.db, {
      ...opts.input,
      userId: opts.context.caller.adminId,
    });
    if (!revision) throw opts.errors.NOT_FOUND();
    return toRevisionOutput(revision);
  });

export const restoreFeedDraftRevisionRoute = contractOS.feeds["draft:restore"]
  .use(rootWriteGuard)
  .handler((opts) =>
    withORPCErrors(async () =>
      toDraftOutput(
        await restoreFeedDraftRevisionService(opts.context.db, {
          draftId: opts.input.draftId,
          revisionId: opts.input.revisionId,
          adminId: opts.context.caller.adminId,
          expectedHash: opts.input.expectedHash,
        })
      )
    )
  );

export const watchFeedDraftRoute = contractOS.feeds["draft:watch"]
  .use(rootWriteGuard)
  .handler((opts) =>
    withORPCErrors(() =>
      watchFeedDraft(opts.context.db, {
        draftId: opts.input.draftId,
        adminId: opts.context.caller.adminId,
        bus: opts.context.draftBus,
        signal: opts.signal,
      })
    )
  );

export const feedsRouter = contractOS.feeds.router({
  list: getFeedsRoute,
  "details-by-slug": getFeedBySlugRoute,
  "details-by-id": getFeedByIdRoute,
  related: getRelatedFeedsRoute,
  search: searchFeedsRoute,
  "search:advanced": searchFeedsAdvancedRoute,
  update: updateFeedRoute,
  delete: deleteFeedRoute,
  restore: restoreFeedRoute,
  summarize: summarizeFeedRoute,
  "summarize:run": getFeedSummaryRunRoute,
  "draft:open": openFeedDraftRoute,
  "draft:get": getFeedDraftRoute,
  "draft:list": listFeedDraftsRoute,
  "draft:patch": patchFeedDraftRoute,
  "draft:edit": editFeedDraftRoute,
  "draft:apply": applyFeedDraftRoute,
  "draft:discard": discardFeedDraftRoute,
  "draft:revisions": listFeedDraftRevisionsRoute,
  "draft:revision": getFeedDraftRevisionRoute,
  "draft:pin": pinFeedDraftRevisionRoute,
  "draft:restore": restoreFeedDraftRevisionRoute,
  "draft:watch": watchFeedDraftRoute,
});

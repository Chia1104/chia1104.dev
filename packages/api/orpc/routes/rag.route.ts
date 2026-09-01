import { countAgentMemories } from "@chia/db/repos/agent/memory";
import { countFeedTranslations } from "@chia/db/repos/feeds";
import {
  getActiveResourceIndexRun,
  getResourceIndexRunByExternalId,
  listResourceIndexRuns,
} from "@chia/db/repos/resources/index-run";
import {
  countChunksNeedingEmbedding,
  deleteStaleEmbeddings,
  getChunkDetail,
  getEmbeddingKeyDistribution,
  getRagOverview,
  getResourceIndexStatus,
  listChunks,
} from "@chia/db/repos/resources/stats";
import { RESOURCE_INDEX_RUN_SCOPE } from "@chia/db/schema";
import { withORPCErrors } from "@chia/service-kit/adapters/orpc";

import {
  currentIndexKey,
  indexRunCursor,
  reconcileIndexRun,
  snapshotOfIndexRun,
  triggerIndexRun,
} from "../../resources/index-run";
import type { IndexRunCaller } from "../../resources/index-run";
import { adminGuard } from "../guards/admin.guard";
import { rateLimitGuard } from "../guards/rate-limit.guard";
import { contractOS } from "../utils";

/**
 * Reads go to the stats repository; runs go through `context.workflow`. Every route is
 * `adminGuard()`, reads included: `resource_chunk` holds body text with no ownership
 * column, stats include unpublished and soft-deleted rows, and sign-up is open.
 */

const callerOf = (opts: {
  context: { adminId: string; session: { user: { id: string } } };
}): IndexRunCaller => ({
  adminId: opts.context.adminId,
  userId: opts.context.session.user.id,
});

export const getRagOverviewRoute = contractOS.rag.overview
  .use(adminGuard())
  .handler(async (opts) => {
    const key = currentIndexKey();
    const [overview, byIndexKey, needingEmbedding, activeRun] =
      await Promise.all([
        getRagOverview(opts.context.db, key),
        getEmbeddingKeyDistribution(opts.context.db, {}),
        countChunksNeedingEmbedding(opts.context.db, key),
        getActiveResourceIndexRun(opts.context.db, {
          scope: RESOURCE_INDEX_RUN_SCOPE.All,
        }),
      ]);

    return {
      ...key,
      ...overview,
      byIndexKey,
      needingEmbedding,
      activeRunId: activeRun?.externalRunId ?? null,
    };
  });

export const listRagChunksRoute = contractOS.rag["chunks:list"]
  .use(adminGuard())
  .handler(async (opts) => {
    const key = currentIndexKey();
    const page = await listChunks(opts.context.db, {
      ...key,
      ...opts.input,
      cursor: opts.input.cursor ?? null,
    });

    return { ...key, ...page };
  });

export const getRagChunkRoute = contractOS.rag["chunk:get"]
  .use(adminGuard())
  .handler(async (opts) => {
    const key = currentIndexKey();
    const chunk = await getChunkDetail(opts.context.db, {
      ...key,
      chunkId: opts.input.chunkId,
    });
    if (!chunk) {
      throw opts.errors.NOT_FOUND();
    }

    return { ...key, chunk };
  });

export const getResourceIndexStatusRoute = contractOS.rag["resource:status"]
  .use(adminGuard())
  .handler(async (opts) => {
    const key = currentIndexKey();
    const [status, activeRun] = await Promise.all([
      getResourceIndexStatus(opts.context.db, { ...key, ref: opts.input }),
      getActiveResourceIndexRun(opts.context.db, {
        scope: RESOURCE_INDEX_RUN_SCOPE.Resource,
        sourceType: opts.input.sourceType,
        sourceId: opts.input.sourceId,
      }),
    ]);

    return {
      ...key,
      ...status,
      activeRunId: activeRun?.externalRunId ?? null,
    };
  });

/** Every active row is reconciled against its run before it is returned. */
export const listIndexRunsRoute = contractOS.rag["runs:list"]
  .use(adminGuard())
  .handler((opts) =>
    withORPCErrors(async () => {
      const { db, workflow } = opts.context;
      const page = await listResourceIndexRuns(db, {
        limit: opts.input.limit,
        cursor: indexRunCursor(opts.input.cursor),
      });
      const items = await Promise.all(
        page.items.map((row) => reconcileIndexRun(db, workflow, row))
      );

      return {
        ...currentIndexKey(),
        items: items.map(snapshotOfIndexRun),
        nextCursor: page.nextCursor,
      };
    })
  );

export const getIndexRunRoute = contractOS.rag["run:get"]
  .use(adminGuard())
  .handler((opts) =>
    withORPCErrors(async () => {
      const { db, workflow } = opts.context;
      const row = await getResourceIndexRunByExternalId(db, {
        externalRunId: opts.input.runId,
      });
      if (!row) {
        throw opts.errors.NOT_FOUND();
      }

      return {
        ...currentIndexKey(),
        run: snapshotOfIndexRun(await reconcileIndexRun(db, workflow, row)),
      };
    })
  );

/** Read directly here: the numbers are queries, not something a run has to report. */
export const previewReindexAllRoute = contractOS.rag["reindex:all:preview"]
  .use(adminGuard())
  .handler(async (opts) => {
    const key = currentIndexKey();
    const [overview, byIndexKey, needingEmbedding, translations, memories] =
      await Promise.all([
        getRagOverview(opts.context.db, key),
        getEmbeddingKeyDistribution(opts.context.db, {}),
        countChunksNeedingEmbedding(opts.context.db, key),
        countFeedTranslations(opts.context.db, {}),
        countAgentMemories(opts.context.db),
      ]);

    return {
      ...key,
      // the same population `listReindexTargetsStep` walks
      targets: translations + memories,
      counts: overview.counts,
      needingEmbedding,
      byIndexKey,
    };
  });

export const indexResourceRoute = contractOS.rag["resource:index"]
  .use(adminGuard())
  .use(rateLimitGuard({ prefix: "rate-limiter:rag-index" }))
  .handler((opts) =>
    withORPCErrors(async () => {
      const { db, workflow } = opts.context;
      const handle = await triggerIndexRun(
        db,
        workflow,
        callerOf(opts),
        {
          scope: RESOURCE_INDEX_RUN_SCOPE.Resource,
          sourceType: opts.input.sourceType,
          sourceId: opts.input.sourceId,
        },
        () => workflow.startResourceIndex(opts.input)
      );

      return { ...currentIndexKey(), ...handle };
    })
  );

export const indexFeedRoute = contractOS.rag["feed:index"]
  .use(adminGuard())
  .use(rateLimitGuard({ prefix: "rate-limiter:rag-index" }))
  .handler((opts) =>
    withORPCErrors(async () => {
      const { db, workflow } = opts.context;
      const handle = await triggerIndexRun(
        db,
        workflow,
        callerOf(opts),
        { scope: RESOURCE_INDEX_RUN_SCOPE.Feed, feedId: opts.input.feedId },
        () => workflow.startFeedIndex(opts.input.feedId)
      );

      return { ...currentIndexKey(), ...handle };
    })
  );

/** Two per hour: a full reindex is the one action here with an unbounded bill. */
export const reindexAllRoute = contractOS.rag["reindex:all"]
  .use(adminGuard())
  .use(
    rateLimitGuard({
      prefix: "rate-limiter:rag-bulk",
      limit: 2,
      windowMs: 3_600_000,
    })
  )
  .handler((opts) =>
    withORPCErrors(async () => {
      const { db, workflow } = opts.context;
      const handle = await triggerIndexRun(
        db,
        workflow,
        callerOf(opts),
        { scope: RESOURCE_INDEX_RUN_SCOPE.All },
        () =>
          workflow.startResourceReindex({ onlyMissing: opts.input.onlyMissing })
      );

      return { ...currentIndexKey(), ...handle };
    })
  );

export const pruneEmbeddingsRoute = contractOS.rag["embeddings:prune"]
  .use(adminGuard())
  .use(
    rateLimitGuard({
      prefix: "rate-limiter:rag-bulk",
      limit: 2,
      windowMs: 3_600_000,
    })
  )
  .handler((opts) =>
    withORPCErrors(async () => {
      const key = currentIndexKey();
      const result = await deleteStaleEmbeddings(opts.context.db, key);

      return { ...key, ...result };
    })
  );

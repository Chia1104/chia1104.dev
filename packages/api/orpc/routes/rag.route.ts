import { resolveEmbeddingProvider } from "@chia/ai/embeddings/provider";
import { EMBEDDING_INDEX_VERSION } from "@chia/ai/embeddings/utils";
import { countFeedTranslations } from "@chia/db/repos/feeds";
import { getActiveResourceIndexRun } from "@chia/db/repos/resources/index-run";
import {
  countChunksNeedingEmbedding,
  getChunkDetail,
  getEmbeddingKeyDistribution,
  getRagOverview,
  getResourceIndexStatus,
  listChunks,
} from "@chia/db/repos/resources/stats";
import type { ResourceIndexKey } from "@chia/db/repos/resources/stats";
import { RESOURCE_INDEX_RUN_SCOPE } from "@chia/db/schema";
import { toORPCError } from "@chia/service-kit/adapters/orpc";
import { isAppError } from "@chia/service-kit/errors";

import { adminGuard } from "../guards/admin.guard";
import { rateLimitGuard } from "../guards/rate-limit.guard";
import { getIndexingService } from "../indexing";
import type { IndexingCaller } from "../indexing";
import { contractOS } from "../utils";

/**
 * RAG management routes.
 *
 * Reads go straight to the stats repository; triggers go through the indexing port,
 * which is only registered in the process that owns the workflow runtime — calling one
 * anywhere else fails with `SERVICE_UNAVAILABLE` instead of pretending to have started.
 *
 * **Every route is `adminGuard()`, reads included.** A session alone is not enough:
 * `resource_chunk` holds the body text of every indexed resource with no ownership column
 * to filter on, and the stats queries deliberately include unpublished and soft-deleted
 * rows because that is what an operator needs to see. Gating reads on `authGuard` would
 * therefore let anyone who can sign up — magic link and OAuth are both open — page and
 * full-text search the whole corpus, drafts included. `adminGuard()` also pins to the
 * configured admin id, which is the right scope: the public site serves that one author's
 * feeds, so the corpus is theirs.
 */

/** The key everything is measured against: provider id plus strategy version. */
const currentIndexKey = (): ResourceIndexKey => ({
  model: resolveEmbeddingProvider().id,
  indexVersion: EMBEDDING_INDEX_VERSION,
});

const callerOf = (opts: {
  context: { adminId: string; session: { user: { id: string } } };
}): IndexingCaller => ({
  adminId: opts.context.adminId,
  userId: opts.context.session.user.id,
});

// ============================================
// Reads
// ============================================

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

/** Goes through the port rather than the repository: the rows need reconciling first. */
export const listIndexRunsRoute = contractOS.rag["runs:list"]
  .use(adminGuard())
  .handler(async (opts) => {
    try {
      const page = await getIndexingService().listRuns({
        limit: opts.input.limit,
        cursor: opts.input.cursor ?? null,
      });

      return { ...currentIndexKey(), ...page };
    } catch (error) {
      throw isAppError(error) ? toORPCError(error) : error;
    }
  });

export const getIndexRunRoute = contractOS.rag["run:get"]
  .use(adminGuard())
  .handler(async (opts) => {
    try {
      const run = await getIndexingService().getRun(opts.input);
      if (!run) {
        throw opts.errors.NOT_FOUND();
      }

      return { ...currentIndexKey(), run };
    } catch (error) {
      throw isAppError(error) ? toORPCError(error) : error;
    }
  });

/** Read directly here: the numbers are queries, not something a run has to report. */
export const previewReindexAllRoute = contractOS.rag["reindex:all:preview"]
  .use(adminGuard())
  .handler(async (opts) => {
    const key = currentIndexKey();
    const [overview, byIndexKey, needingEmbedding, targets] = await Promise.all(
      [
        getRagOverview(opts.context.db, key),
        getEmbeddingKeyDistribution(opts.context.db, {}),
        countChunksNeedingEmbedding(opts.context.db, key),
        countFeedTranslations(opts.context.db, {}),
      ]
    );

    return {
      ...key,
      targets,
      counts: overview.counts,
      needingEmbedding,
      byIndexKey,
    };
  });

// ============================================
// Triggers
// ============================================

export const indexResourceRoute = contractOS.rag["resource:index"]
  .use(adminGuard())
  .use(rateLimitGuard({ prefix: "rate-limiter:rag-index" }))
  .handler(async (opts) => {
    try {
      const handle = await getIndexingService().indexResource(
        callerOf(opts),
        opts.input
      );

      return { ...currentIndexKey(), ...handle };
    } catch (error) {
      throw isAppError(error) ? toORPCError(error) : error;
    }
  });

export const indexFeedRoute = contractOS.rag["feed:index"]
  .use(adminGuard())
  .use(rateLimitGuard({ prefix: "rate-limiter:rag-index" }))
  .handler(async (opts) => {
    try {
      const handle = await getIndexingService().indexFeed(
        callerOf(opts),
        opts.input
      );

      return { ...currentIndexKey(), ...handle };
    } catch (error) {
      throw isAppError(error) ? toORPCError(error) : error;
    }
  });

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
  .handler(async (opts) => {
    try {
      const handle = await getIndexingService().reindexAll(
        callerOf(opts),
        opts.input
      );

      return { ...currentIndexKey(), ...handle };
    } catch (error) {
      throw isAppError(error) ? toORPCError(error) : error;
    }
  });

export const pruneEmbeddingsRoute = contractOS.rag["embeddings:prune"]
  .use(adminGuard())
  .use(
    rateLimitGuard({
      prefix: "rate-limiter:rag-bulk",
      limit: 2,
      windowMs: 3_600_000,
    })
  )
  .handler(async (opts) => {
    try {
      const result = await getIndexingService().pruneEmbeddings(callerOf(opts));

      return { ...currentIndexKey(), ...result };
    } catch (error) {
      throw isAppError(error) ? toORPCError(error) : error;
    }
  });

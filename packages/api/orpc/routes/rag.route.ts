import { resolveEmbeddingProvider } from "@chia/ai/embeddings/provider";
import { EMBEDDING_INDEX_VERSION } from "@chia/ai/embeddings/utils";
import type { Session } from "@chia/auth/types";
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
import { Role } from "@chia/db/types";
import { toORPCError } from "@chia/service-kit/adapters/orpc";
import { isAppError } from "@chia/service-kit/errors";

import { adminGuard, adminIdGuard } from "../guards/admin.guard";
import { authGuard } from "../guards/auth.guard";
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
 * `adminGuard()` pins to the configured admin id, so a logged-in non-admin cannot reach
 * a trigger even with a valid session. It matters here because these routes spend
 * embedding credits.
 */

/** Roles allowed to trigger, mirroring `adminPolicy`'s default. */
const TRIGGER_ROLES: Role[] = [Role.Admin, Role.Root];

/**
 * The one evaluation of "may this session trigger indexing".
 *
 * Restates `adminPolicy({ pinToAdminId: true })` because the read routes need the answer
 * as a value rather than as a rejection — the dashboard disables its buttons from this
 * and never decides authorization itself. `adminGuard()` is still the only thing that
 * blocks a trigger; this only affects appearance.
 */
const canTrigger = (
  session: Session | null | undefined,
  adminId: string
): boolean =>
  !!session?.user &&
  TRIGGER_ROLES.includes(session.user.role) &&
  session.user.id === adminId;

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
  .use(authGuard)
  .use(adminIdGuard)
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
      canTrigger: canTrigger(opts.context.session, opts.context.adminId),
      ...overview,
      byIndexKey,
      needingEmbedding,
      activeRunId: activeRun?.externalRunId ?? null,
    };
  });

export const listRagChunksRoute = contractOS.rag["chunks:list"]
  .use(authGuard)
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
  .use(authGuard)
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
  .use(authGuard)
  .use(adminIdGuard)
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
      canTrigger: canTrigger(opts.context.session, opts.context.adminId),
      ...status,
      activeRunId: activeRun?.externalRunId ?? null,
    };
  });

/** Goes through the port rather than the repository: the rows need reconciling first. */
export const listIndexRunsRoute = contractOS.rag["runs:list"]
  .use(authGuard)
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
  .use(authGuard)
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
  .use(authGuard)
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

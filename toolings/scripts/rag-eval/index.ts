import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { and, eq, inArray, isNull } from "drizzle-orm";

import { POST_BODY_TOKEN_BUDGET } from "@chia/agent-content/tools/read";
import { buildDocumentContext } from "@chia/ai/embeddings/context";
import { resolveEmbeddingProvider } from "@chia/ai/embeddings/provider";
import { EMBEDDING_INDEX_VERSION } from "@chia/ai/embeddings/utils";
import { resolveRerankProvider } from "@chia/ai/rerank/provider";
import { connectDatabase, getConnection } from "@chia/db/client";
import * as schema from "@chia/db/schema";
import { searchFeedsService } from "@chia/services/feeds/search.service";
import type { SearchFeedsProvider } from "@chia/services/feeds/search.service";
import { ResourceType } from "@chia/services/rag/resource-types";
import { searchResources } from "@chia/services/rag/search.service";
import type { ResourceSearchHit } from "@chia/services/rag/search.service";

import { GOLDEN_QUERIES } from "./golden-queries.ts";
import type { GoldenQuery, GoldenQueryKind } from "./golden-queries.ts";

/**
 * Retrieval-quality benchmark: runs the golden queries through the real search
 * stack (same code path the API serves) and reports Recall@K / MRR per mode.
 *
 * Run it before and after any change that affects ranking — chunking, index
 * version bumps, fusion constants, aggregation — and compare the reports.
 *
 *   pnpm --filter rag-eval eval
 *   pnpm --filter rag-eval eval mode=bm25 kind=heading
 *   pnpm --filter rag-eval eval out=baseline.json
 *   pnpm --filter rag-eval eval rerank=true   # adds hybrid+rerank; needs RERANK_PROVIDER + RERANK_API_KEY
 */

const MODES: SearchFeedsProvider[] = ["bm25", "semantic", "hybrid"];
/** hybrid through the configured reranker, the path the agent ports take; opt-in because it calls a paid model */
const RERANK_MODE = "hybrid+rerank";
type EvalMode = SearchFeedsProvider | typeof RERANK_MODE;
/** Ranks past this count as a miss. */
const MAX_K = 10;
const RECALL_KS = [1, 3, 5, 10] as const;
type RecallK = (typeof RECALL_KS)[number];

/** One value per K in `RECALL_KS`; a K added there without one here does not compile. */
const perK = <T>(valueAt: (k: RecallK) => T): Record<RecallK, T> => ({
  1: valueAt(1),
  3: valueAt(3),
  5: valueAt(5),
  10: valueAt(10),
});

interface CLIOptions {
  /** `all` (default) or one of `bm25 | semantic | hybrid | hybrid+rerank` */
  mode?: string;
  /** `true` appends `hybrid+rerank` to the modes */
  rerank?: string;
  /** run only queries with this kind */
  kind?: string;
  /** run only the query with this id */
  id?: string;
  /** write the full report as JSON to this path */
  out?: string;
  /** database env for `connectDatabase`; defaults to `local` */
  env?: string;
  /** explicit connection string; takes precedence over `env` */
  "db-url"?: string;
}

const getCLIOptions = (): CLIOptions => {
  const options: Record<string, string> = {};
  for (const arg of process.argv.slice(2)) {
    const [key, value] = arg.split("=");
    if (key && value) {
      options[key] = value;
    }
  }
  return options;
};

interface QueryResult {
  id: string;
  kind: GoldenQueryKind;
  query: string;
  locale: string | null;
  expected: string[];
  /** slugs in rank order, length ≤ MAX_K */
  returned: string[];
  /** 1-based rank of the first expected slug, null on a miss */
  firstHitRank: number | null;
  recall: Record<RecallK, number>;
  /** best chunk of the first expected hit — what a citation would point at */
  bestChunk: { kind: string; headingPath: string | null } | null;
  /**
   * Whether that chunk is a section under the expected heading. Only set for
   * queries with `expectedHeading`; a ranked miss counts as a citation miss.
   */
  citationHit: boolean | null;
  /** Whether any chunk the hit returned is a section under the expected heading. */
  sectionHit: boolean | null;
  /** Share of `expectedHeadings` some returned chunk sits under; null without them. */
  coverage: number | null;
  /**
   * Share of the expected headings still present once `get_post` has fitted the post into its
   * token budget with the hit's headings as focus: found is not read. Null without expectations.
   */
  readCoverage: number | null;
  /** the reranker's P(true) that some hit answers the query; null outside `hybrid+rerank` */
  answerable: number | null;
  durationMs: number;
  error?: string;
}

interface ModeReport {
  mode: EvalMode;
  results: QueryResult[];
  recall: Record<RecallK, number>;
  /** Only the kinds the run's queries cover. */
  recallByKind: Partial<Record<GoldenQueryKind, number>>;
  /** R@1 per kind: R@5 cannot tell a `confusable` query's neighbours from its answer */
  topRankByKind: Partial<Record<GoldenQueryKind, number>>;
  mrr: number;
  /** share of `expectedHeading` queries whose best chunk is the right section */
  citationAccuracy: number | null;
  /** share of `expectedHeading` queries where any returned chunk is the right section */
  sectionAccuracy: number | null;
  /** mean `coverage` over the queries that set `expectedHeadings` */
  coverage: number | null;
  /** mean `readCoverage` */
  readCoverage: number | null;
  /** mean `answerable` */
  answerable: number | null;
  avgDurationMs: number;
  errors: number;
}

const mean = (values: number[]): number =>
  values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length;

const recallAt = (expected: string[], returned: string[], k: number): number =>
  expected.filter((slug) => returned.slice(0, k).includes(slug)).length /
  expected.length;

/** Reads the hit the way `get_post` does and reports which expected headings survive the budget. */
const readCoverageOf = async (
  db: Awaited<ReturnType<typeof connectDatabase>>,
  translationId: number,
  matchedHeadingPaths: string[],
  expectedHeadings: string[]
): Promise<number> => {
  const [translation] = await db
    .select({
      title: schema.feedTranslations.title,
      locale: schema.feedTranslations.locale,
      content: schema.feedTranslations.content,
    })
    .from(schema.feedTranslations)
    .where(eq(schema.feedTranslations.id, translationId));
  if (!translation) {
    return 0;
  }
  const { documents } = await buildDocumentContext(
    [
      {
        slug: String(translationId),
        locale: translation.locale,
        title: translation.title,
        content: translation.content ?? "",
        matchedHeadingPaths,
      },
    ],
    { budget: POST_BODY_TOKEN_BUDGET }
  );
  const kept = (documents[0]?.anchors ?? []).map((anchor) =>
    anchor.path.toLowerCase()
  );
  return (
    expectedHeadings.filter((heading) =>
      kept.some((path) => path.includes(heading.toLowerCase()))
    ).length / expectedHeadings.length
  );
};

const runQuery = async (
  db: Awaited<ReturnType<typeof connectDatabase>>,
  mode: EvalMode,
  golden: GoldenQuery
): Promise<QueryResult> => {
  const searchMode: SearchFeedsProvider =
    mode === RERANK_MODE ? "hybrid" : mode;
  const rerank = mode === RERANK_MODE;
  const base = {
    id: golden.id,
    kind: golden.kind,
    query: golden.query,
    locale: golden.locale ?? null,
    expected: golden.expected,
  };

  const startedAt = performance.now();
  try {
    let result: {
      items: (ResourceSearchHit & { slug: string })[];
      answerable?: number;
    };
    if (golden.kind === "memory") {
      const memory = await searchResources({
        db,
        query: golden.query,
        mode: searchMode,
        sourceTypes: [ResourceType.AgentMemory],
        includeUnpublished: true,
        limit: MAX_K,
        rerank,
      });
      result = {
        answerable: memory.answerable,
        items: memory.items.map((item) => ({
          ...item,
          // the memory adapter hydrates a source's URL into `description`
          slug: item.summary.description ?? "",
        })),
      };
    } else {
      result = await searchFeedsService({
        db,
        keyword: golden.query,
        model: searchMode,
        locale: golden.locale,
        limit: MAX_K,
        rerank,
      });
    }
    const { items } = result;
    const answerable = result.answerable ?? null;
    const returned = items.map((item) => item.slug);
    const firstHit = returned.findIndex((slug) =>
      golden.expected.includes(slug)
    );
    const hitItem = items[firstHit] ?? null;
    const isUnder =
      (heading: string) => (chunk: { kind: string; headingPaths: string[] }) =>
        chunk.kind === "section" &&
        chunk.headingPaths.some((path) =>
          path.toLowerCase().includes(heading.toLowerCase())
        );
    const underExpectedHeading = isUnder(golden.expectedHeading ?? "");
    const chunks = hitItem?.chunks ?? [];
    const [best] = chunks;
    const durationMs = performance.now() - startedAt;
    const expectedHeadings =
      golden.expectedHeadings ??
      (golden.expectedHeading ? [golden.expectedHeading] : []);
    const bestChunk = best
      ? { kind: best.kind, headingPath: best.headingPath }
      : null;

    return {
      ...base,
      returned,
      firstHitRank: firstHit === -1 ? null : firstHit + 1,
      recall: perK((k) => recallAt(golden.expected, returned, k)),
      bestChunk,
      citationHit: golden.expectedHeading
        ? best !== undefined && underExpectedHeading(best)
        : null,
      sectionHit: golden.expectedHeading
        ? chunks.some(underExpectedHeading)
        : null,
      coverage: golden.expectedHeadings
        ? golden.expectedHeadings.filter((heading) =>
            chunks.some(isUnder(heading))
          ).length / golden.expectedHeadings.length
        : null,
      readCoverage:
        expectedHeadings.length === 0
          ? null
          : hitItem
            ? await readCoverageOf(
                db,
                hitItem.sourceId,
                chunks.flatMap((chunk) => chunk.headingPaths),
                expectedHeadings
              )
            : 0,
      answerable,
      durationMs,
    };
  } catch (error) {
    return {
      ...base,
      returned: [],
      firstHitRank: null,
      recall: perK(() => 0),
      bestChunk: null,
      citationHit: golden.expectedHeading ? false : null,
      sectionHit: golden.expectedHeading ? false : null,
      coverage: golden.expectedHeadings ? 0 : null,
      readCoverage:
        golden.expectedHeadings || golden.expectedHeading ? 0 : null,
      answerable: null,
      durationMs: performance.now() - startedAt,
      error: String(error),
    };
  }
};

const buildModeReport = (
  mode: EvalMode,
  results: QueryResult[]
): ModeReport => {
  const kinds = [...new Set(results.map((result) => result.kind))];
  const recallByKindAt = (k: RecallK) => {
    const byKind: Partial<Record<GoldenQueryKind, number>> = {};
    for (const kind of kinds) {
      byKind[kind] = mean(
        results
          .filter((result) => result.kind === kind)
          .map((result) => result.recall[k])
      );
    }
    return byKind;
  };
  return {
    mode,
    results,
    recall: perK((k) => mean(results.map((result) => result.recall[k]))),
    recallByKind: recallByKindAt(5),
    topRankByKind: recallByKindAt(1),
    mrr: mean(
      results.map((result) =>
        result.firstHitRank === null ? 0 : 1 / result.firstHitRank
      )
    ),
    citationAccuracy: (() => {
      const cited = results.filter((result) => result.citationHit !== null);
      return cited.length === 0
        ? null
        : mean(cited.map((result) => (result.citationHit ? 1 : 0)));
    })(),
    sectionAccuracy: (() => {
      const cited = results.filter((result) => result.sectionHit !== null);
      return cited.length === 0
        ? null
        : mean(cited.map((result) => (result.sectionHit ? 1 : 0)));
    })(),
    coverage: (() => {
      const covered = results.flatMap((result) =>
        result.coverage === null ? [] : [result.coverage]
      );
      return covered.length === 0 ? null : mean(covered);
    })(),
    readCoverage: (() => {
      const read = results.flatMap((result) =>
        result.readCoverage === null ? [] : [result.readCoverage]
      );
      return read.length === 0 ? null : mean(read);
    })(),
    answerable: (() => {
      const judged = results.flatMap((result) =>
        result.answerable === null ? [] : [result.answerable]
      );
      return judged.length === 0 ? null : mean(judged);
    })(),
    avgDurationMs: mean(results.map((result) => result.durationMs)),
    errors: results.filter((result) => result.error).length,
  };
};

/**
 * A fixture slug that no longer resolves must fail the run: it would otherwise
 * deflate recall forever and read as a quality regression.
 */
const assertFixtureSlugs = async (
  db: Awaited<ReturnType<typeof connectDatabase>>,
  queries: GoldenQuery[]
): Promise<void> => {
  const expectedOf = (memory: boolean) => [
    ...new Set(
      queries
        .filter((query) => (query.kind === "memory") === memory)
        .flatMap((query) => query.expected)
    ),
  ];
  const slugs = expectedOf(false);
  const urls = expectedOf(true);

  const feedRows =
    slugs.length === 0
      ? []
      : await db
          .select({ key: schema.feeds.slug })
          .from(schema.feeds)
          .where(inArray(schema.feeds.slug, slugs));
  const memoryRows =
    urls.length === 0
      ? []
      : await db
          .select({ key: schema.agentMemories.sourceUrl })
          .from(schema.agentMemories)
          .where(
            and(
              inArray(schema.agentMemories.sourceUrl, urls),
              eq(schema.agentMemories.kind, "source"),
              isNull(schema.agentMemories.deletedAt)
            )
          );

  const known = new Set([...feedRows, ...memoryRows].map((row) => row.key));
  const missing = [...slugs, ...urls].filter((key) => !known.has(key));
  if (missing.length > 0) {
    throw new Error(
      `Golden queries reference posts or stored pages that do not exist: ${missing.join(", ")}. ` +
        `Fix golden-queries.ts (or restore the local database).`
    );
  }
};

/**
 * `1✓` — rank, plus the citation verdict or `2/3` section coverage when the
 * query checks one, and the reranker's answer probability as `.93` under `hybrid+rerank`.
 */
const formatRank = (result: QueryResult, expectedHeadings = 0): string => {
  if (result.error) {
    return "err";
  }
  const rank = result.firstHitRank?.toString() ?? "-";
  const answerable =
    result.answerable === null
      ? ""
      : ` ${result.answerable.toFixed(2).replace(/^0/, "")}`;
  if (result.coverage !== null) {
    return `${rank} ${Math.round(result.coverage * expectedHeadings)}/${expectedHeadings}${answerable}`;
  }
  return (
    (result.citationHit === null
      ? rank
      : `${rank}${result.citationHit ? "✓" : "✗"}`) + answerable
  );
};

const pad = (value: string, width: number): string => value.padEnd(width);
const num = (value: number): string => value.toFixed(2);

const printReport = (queries: GoldenQuery[], reports: ModeReport[]): void => {
  const idWidth = Math.max(...queries.map((query) => query.id.length)) + 2;
  const kindWidth = 12;
  const colWidth = 12;

  console.log(
    `\n${pad("query", idWidth)}${pad("kind", kindWidth)}` +
      reports.map((report) => pad(report.mode, colWidth)).join("")
  );
  for (const query of queries) {
    const cells = reports.map((report) => {
      const result = report.results.find((entry) => entry.id === query.id)!;
      return pad(formatRank(result, query.expectedHeadings?.length), colWidth);
    });
    console.log(
      `${pad(query.id, idWidth)}${pad(query.kind, kindWidth)}${cells.join("")}`
    );
  }

  console.log(
    `\n${pad("mode", 14)}R@1     R@3     R@5     R@10    MRR@10  cite    cite@3  cover   read    ans     avg ms`
  );
  for (const report of reports) {
    console.log(
      pad(report.mode, 14) +
        RECALL_KS.map((k) => pad(num(report.recall[k]), 8)).join("") +
        pad(num(report.mrr), 8) +
        pad(
          report.citationAccuracy === null ? "-" : num(report.citationAccuracy),
          8
        ) +
        pad(
          report.sectionAccuracy === null ? "-" : num(report.sectionAccuracy),
          8
        ) +
        pad(report.coverage === null ? "-" : num(report.coverage), 8) +
        pad(report.readCoverage === null ? "-" : num(report.readCoverage), 8) +
        pad(report.answerable === null ? "-" : num(report.answerable), 8) +
        Math.round(report.avgDurationMs).toString()
    );
  }

  const kinds = [...new Set(queries.map((query) => query.kind))];
  for (const [title, pick] of [
    ["R@1 by kind", (report: ModeReport) => report.topRankByKind],
    ["R@5 by kind", (report: ModeReport) => report.recallByKind],
  ] as const) {
    console.log(`\n${title}`);
    console.log(
      `${pad("mode", 14)}` + kinds.map((kind) => pad(kind, kindWidth)).join("")
    );
    for (const report of reports) {
      console.log(
        pad(report.mode, 14) +
          kinds
            .map((kind) => pad(num(pick(report)[kind] ?? 0), kindWidth))
            .join("")
      );
    }
  }

  for (const report of reports) {
    if (report.errors > 0) {
      const first = report.results.find((result) => result.error);
      console.error(
        `\n${report.errors} ${report.mode} queries failed; first error (${first?.id}): ${first?.error}`
      );
    }
  }
};

const main = async (): Promise<void> => {
  const options = getCLIOptions();

  const allModes: EvalMode[] = [...MODES, RERANK_MODE];
  const modes: EvalMode[] =
    options.mode && options.mode !== "all"
      ? allModes.filter((mode) => mode === options.mode)
      : [...MODES];
  if (options.rerank === "true" && !modes.includes(RERANK_MODE)) {
    modes.push(RERANK_MODE);
  }
  if (modes.length === 0) {
    throw new Error(
      `Unknown mode "${options.mode}". Use ${MODES.join(" | ")} | ${RERANK_MODE} | all.`
    );
  }
  if (modes.includes(RERANK_MODE) && resolveRerankProvider() === null) {
    throw new Error(
      `${RERANK_MODE} needs RERANK_PROVIDER (and its RERANK_API_KEY) in the environment.`
    );
  }

  let queries = GOLDEN_QUERIES;
  if (options.kind) {
    queries = queries.filter((query) => query.kind === options.kind);
  }
  if (options.id) {
    queries = queries.filter((query) => query.id === options.id);
  }
  if (queries.length === 0) {
    throw new Error("No golden queries match the given filters.");
  }

  // `withCache: false` — a cached read would let one mode serve another's rows
  // and corrupt the latency numbers
  const db = options["db-url"]
    ? await getConnection(options["db-url"], { withCache: false })
    : await connectDatabase(options.env ?? "local", { withCache: false });
  await assertFixtureSlugs(db, queries);

  const indexKey = {
    model: resolveEmbeddingProvider().id,
    indexVersion: EMBEDDING_INDEX_VERSION,
  };
  console.log(
    `RAG retrieval eval — ${queries.length} queries · model ${indexKey.model} · index ${indexKey.indexVersion}`
  );

  // Serial on purpose: concurrent queries would contend for the pool and the
  // embedding API, turning avg ms into noise.
  const reports: ModeReport[] = [];
  for (const mode of modes) {
    const results: QueryResult[] = [];
    for (const query of queries) {
      results.push(await runQuery(db, mode, query));
    }
    reports.push(buildModeReport(mode, results));
  }

  printReport(queries, reports);

  if (options.out) {
    mkdirSync(dirname(options.out), { recursive: true });
    writeFileSync(
      options.out,
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          ...indexKey,
          maxK: MAX_K,
          queryCount: queries.length,
          modes: reports,
        },
        null,
        2
      )}\n`
    );
    console.log(`\nreport written to ${options.out}`);
  }
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

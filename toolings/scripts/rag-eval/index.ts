import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { inArray } from "drizzle-orm";

import { resolveEmbeddingProvider } from "@chia/ai/embeddings/provider";
import { EMBEDDING_INDEX_VERSION } from "@chia/ai/embeddings/utils";
import { searchFeedsService } from "@chia/api/feeds/search";
import type { SearchFeedsProvider } from "@chia/api/feeds/search";
import { schema } from "@chia/db";
import { connectDatabase, getConnection } from "@chia/db/client";

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
 */

const MODES: SearchFeedsProvider[] = ["bm25", "semantic", "hybrid"];
/** Ranks past this count as a miss. */
const MAX_K = 10;
const RECALL_KS = [1, 3, 5, 10] as const;

interface CLIOptions {
  /** `all` (default) or one of `bm25 | semantic | hybrid` */
  mode?: string;
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
  recall: Record<number, number>;
  /** best chunk of the first expected hit — what a citation would point at */
  bestChunk: { kind: string; headingPath: string | null } | null;
  /**
   * Whether that chunk is a section under the expected heading. Only set for
   * queries with `expectedHeading`; a ranked miss counts as a citation miss.
   */
  citationHit: boolean | null;
  durationMs: number;
  error?: string;
}

interface ModeReport {
  mode: SearchFeedsProvider;
  results: QueryResult[];
  recall: Record<number, number>;
  recallByKind: Record<GoldenQueryKind, number>;
  mrr: number;
  /** share of `expectedHeading` queries whose best chunk is the right section */
  citationAccuracy: number | null;
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

const runQuery = async (
  db: Awaited<ReturnType<typeof connectDatabase>>,
  mode: SearchFeedsProvider,
  golden: GoldenQuery
): Promise<QueryResult> => {
  const base = {
    id: golden.id,
    kind: golden.kind,
    query: golden.query,
    locale: golden.locale ?? null,
    expected: golden.expected,
  };

  const startedAt = performance.now();
  try {
    const { items } = await searchFeedsService({
      db,
      keyword: golden.query,
      model: mode,
      locale: golden.locale,
      limit: MAX_K,
    });
    const returned = items.map((item) => item.slug);
    const firstHit = returned.findIndex((slug) =>
      golden.expected.includes(slug)
    );
    const hitItem = firstHit === -1 ? null : items[firstHit]!;
    const bestChunk = hitItem
      ? {
          kind: hitItem.bestChunk.kind,
          headingPath: hitItem.bestChunk.headingPath,
        }
      : null;

    return {
      ...base,
      returned,
      firstHitRank: firstHit === -1 ? null : firstHit + 1,
      recall: Object.fromEntries(
        RECALL_KS.map((k) => [k, recallAt(golden.expected, returned, k)])
      ),
      bestChunk,
      citationHit: golden.expectedHeading
        ? bestChunk?.kind === "section" &&
          (bestChunk.headingPath ?? "")
            .toLowerCase()
            .includes(golden.expectedHeading.toLowerCase())
        : null,
      durationMs: performance.now() - startedAt,
    };
  } catch (error) {
    return {
      ...base,
      returned: [],
      firstHitRank: null,
      recall: Object.fromEntries(RECALL_KS.map((k) => [k, 0])),
      bestChunk: null,
      citationHit: golden.expectedHeading ? false : null,
      durationMs: performance.now() - startedAt,
      error: String(error),
    };
  }
};

const buildModeReport = (
  mode: SearchFeedsProvider,
  results: QueryResult[]
): ModeReport => {
  const kinds = [...new Set(results.map((result) => result.kind))];
  return {
    mode,
    results,
    recall: Object.fromEntries(
      RECALL_KS.map((k) => [
        k,
        mean(results.map((result) => result.recall[k]!)),
      ])
    ),
    recallByKind: Object.fromEntries(
      kinds.map((kind) => [
        kind,
        mean(
          results
            .filter((result) => result.kind === kind)
            .map((result) => result.recall[5]!)
        ),
      ])
    ) as Record<GoldenQueryKind, number>,
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
  const slugs = [...new Set(queries.flatMap((query) => query.expected))];
  const rows = await db
    .select({ slug: schema.feeds.slug })
    .from(schema.feeds)
    .where(inArray(schema.feeds.slug, slugs));
  const known = new Set(rows.map((row) => row.slug));
  const missing = slugs.filter((slug) => !known.has(slug));
  if (missing.length > 0) {
    throw new Error(
      `Golden queries reference slugs that do not exist: ${missing.join(", ")}. ` +
        `Fix golden-queries.ts (or restore the local database).`
    );
  }
};

/** `1✓` — rank, plus the citation verdict when the query checks one. */
const formatRank = (result: QueryResult): string => {
  if (result.error) {
    return "err";
  }
  const rank = result.firstHitRank?.toString() ?? "-";
  return result.citationHit === null
    ? rank
    : `${rank}${result.citationHit ? "✓" : "✗"}`;
};

const pad = (value: string, width: number): string => value.padEnd(width);
const num = (value: number): string => value.toFixed(2);

const printReport = (queries: GoldenQuery[], reports: ModeReport[]): void => {
  const idWidth = Math.max(...queries.map((query) => query.id.length)) + 2;
  const kindWidth = 12;
  const colWidth = 10;

  console.log(
    `\n${pad("query", idWidth)}${pad("kind", kindWidth)}` +
      reports.map((report) => pad(report.mode, colWidth)).join("")
  );
  for (const query of queries) {
    const cells = reports.map((report) => {
      const result = report.results.find((entry) => entry.id === query.id)!;
      return pad(formatRank(result), colWidth);
    });
    console.log(
      `${pad(query.id, idWidth)}${pad(query.kind, kindWidth)}${cells.join("")}`
    );
  }

  console.log(
    `\n${pad("mode", 10)}R@1     R@3     R@5     R@10    MRR@10  cite    avg ms`
  );
  for (const report of reports) {
    console.log(
      pad(report.mode, 10) +
        RECALL_KS.map((k) => pad(num(report.recall[k]!), 8)).join("") +
        pad(num(report.mrr), 8) +
        pad(
          report.citationAccuracy === null ? "-" : num(report.citationAccuracy),
          8
        ) +
        Math.round(report.avgDurationMs).toString()
    );
  }

  const kinds = [...new Set(queries.map((query) => query.kind))];
  console.log(`\nR@5 by kind`);
  console.log(
    `${pad("mode", 10)}` + kinds.map((kind) => pad(kind, kindWidth)).join("")
  );
  for (const report of reports) {
    console.log(
      pad(report.mode, 10) +
        kinds
          .map((kind) => pad(num(report.recallByKind[kind] ?? 0), kindWidth))
          .join("")
    );
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

  const modes =
    options.mode && options.mode !== "all"
      ? MODES.filter((mode) => mode === options.mode)
      : MODES;
  if (modes.length === 0) {
    throw new Error(
      `Unknown mode "${options.mode}". Use ${MODES.join(" | ")} | all.`
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

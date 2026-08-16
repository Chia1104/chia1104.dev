# RAG retrieval eval

Retrieval-quality benchmark for the search stack described in
[`docs/rag-architecture.md`](../../../docs/rag-architecture.md). It runs a
fixed set of golden queries through `searchFeedsService` — the same code path
the API serves — and reports Recall@K and MRR per mode (`bm25`, `semantic`,
`hybrid`).

Run it **before and after** any change that affects ranking (chunking,
`EMBEDDING_INDEX_VERSION` bumps, RRF constants, chunk-hit aggregation) and
compare the two reports; without the before-run there is no way to tell an
improvement from a regression.

## Usage

Needs a database holding the real corpus with current embeddings and, for
`semantic` / `hybrid`, `OPENAI_API_KEY` in `.env.global`.

```bash
pnpm --filter rag-eval eval                    # all modes, all queries
pnpm --filter rag-eval eval mode=bm25          # one mode
pnpm --filter rag-eval eval kind=heading       # one query group
pnpm --filter rag-eval eval id=zh-csrf         # one query
pnpm --filter rag-eval eval out=baseline.json  # persist the full report
pnpm --filter rag-eval eval db-url=…           # explicit connection string
```

Without `db-url` it connects like the apps do (`LOCAL_DATABASE_URL`). The
usual local database is dev scratch data, so evaluate against a restored copy
of the production corpus instead — that same copy is where chunking changes
get reindexed and re-measured without touching production:

```bash
toolings/scripts/dump-chia-local.sh /tmp                 # dumps $DATABASE_URL
psql "<local-admin-url>" -c 'CREATE DATABASE "chia-eval"'
DATABASE_URL="<local…/chia-eval>" \
  toolings/scripts/restore-chia-local-paradedb.sh /tmp/chia-local-*.sql
pnpm --filter rag-eval eval "db-url=<local…/chia-eval>" out=reports/baseline.json
```

After a chunking or index-version change, rebuild the copy and measure again:

```bash
pnpm --filter rag-eval reindex "db-url=<local…/chia-eval>"
pnpm --filter rag-eval eval "db-url=<local…/chia-eval>" out=reports/after.json
```

## Reading the report

- The per-query table shows the rank of the first expected slug per mode
  (`-` = not in the top 10).
- `R@K` is averaged over the query set; with single-expected queries it is the
  fraction of queries whose answer appears in the top K.
- `R@5 by kind` is the actionable slice: `paraphrase` measures the semantic
  path, `term` the lexical path, and `heading` the known weak case where the
  answer sits under a heading whose words the section body does not repeat.

## Maintaining the golden set

Queries live in [`golden-queries.ts`](golden-queries.ts). Every expected slug
must exist as a feed — the runner fails fast on unknown slugs so a renamed or
deleted post breaks the eval loudly instead of silently deflating recall. When
publishing a post that is an obvious retrieval target, add a query for it.

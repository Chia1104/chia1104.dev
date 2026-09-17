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
`semantic` / `hybrid`, `EMBEDDING_API_KEY` in `.env.global`.

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
- `cite` is whether the hit's best chunk sits under the query's
  `expectedHeading`; `cite@3` is whether any chunk the hit returned does, which
  is what an agent reading the hit's `matches` can reach.
- `R@K` is averaged over the query set; with single-expected queries it is the
  fraction of queries whose answer appears in the top K.
- `cover` is the share of a `multi` query's `expectedHeadings` that the hit's
  chunks reach (shown per query as `1 2/3`: rank, then sections reached). It is
  the number to watch when changing how many chunks a hit keeps.
- `read` is the share of the expected headings still present after the post
  is fitted into `get_post`'s token budget with the hit's headings as focus.
  Found is not read: it drops when a post outgrows the budget.
- `memory` queries search the agent's stored pages the way `search_memory`
  does and expect source URLs, so they need a database holding those pages;
  the runner fails fast when one is missing.
- `R@1 by kind` and `R@5 by kind` are the actionable slices: `paraphrase`
  measures the semantic path, `term` the lexical path, `heading` the case where
  the answer sits under a heading whose words the section body does not repeat,
  `confusable` whether the right post beats its topical neighbours (read R@1;
  R@5 saturates), and `cross` a query in one language against the other
  locale, which bm25 is expected to miss.

## Agent eval

Retrieval metrics cannot see what the agent does with a hit. `eval:agent` runs
each task in [`agent-tasks.ts`](agent-tasks.ts) as one real public-kind turn
against the real content port and checks it without a model judge: the turn
ends without an error and within the kind's tool budget, links only posts a
tool returned, links the expected post, calls the expected tool with the
expected arguments (a date filter for a count), does not search again for a
post it already found, and says so when the corpus has no answer.

```bash
pnpm --filter rag-eval eval:agent                     # all tasks
pnpm --filter rag-eval eval:agent id=count-2025       # one task
pnpm --filter rag-eval eval:agent model=gpt-5.4-mini  # another OpenAI model
pnpm --filter rag-eval eval:agent "db-url=…" out=reports/agent.json
```

It needs `OPENAI_API_KEY` in `.env.global` and calls the model once per task
on that key. Counts and the newest post are facts of the corpus: update the
task when publishing changes them.

## Maintaining the golden set

Queries live in [`golden-queries.ts`](golden-queries.ts). Every expected slug
must exist as a feed — the runner fails fast on unknown slugs so a renamed or
deleted post breaks the eval loudly instead of silently deflating recall. When
publishing a post that is an obvious retrieval target, add a query for it.

# Guard eval

Benchmark for the guard questions in `@chia/ai/guard/jev`: labelled visitor
messages and fetched pages go through the same calls the agent turn makes, and
the report gives the share flagged per kind at each threshold plus call latency.

Run it **before and after** rewording a question, changing `GUARD_THRESHOLD`, or
adding a guard provider. A new attack seen in production becomes a case here
first.

## Usage

Needs `GUARD_API_KEY` (a TypeSafe API key) in the environment or `.env.global`.
A full run is about 130 calls and costs well under a cent.

```bash
pnpm --filter guard-eval eval                       # messages and documents
pnpm --filter guard-eval eval set=messages
pnpm --filter guard-eval eval kind=benign-hard      # one group
pnpm --filter guard-eval eval id=injection-en-13    # one case
pnpm --filter guard-eval eval out=reports/base.json # persist the full report
```

## Reading the report

- Each line is the probability the case is judged on, the call's wall time and
  the case id. An attack is judged on its own question; a normal message has to
  clear both, so its score is the higher of the two.
- `flagged at` is the share of a kind at or above each threshold: recall for
  attack kinds, false-positive rate for the rest. `benign-hard` is the row that
  decides the threshold: orders about the post ("ignore the intro"), questions
  about prompt injection, persona wording, and pages that quote attacks or are
  written for coding agents.
- Injected pages place one payload at the start, middle or end of 2k and 16k
  characters of unrelated prose. 16k is what `fetch_url` shows the model; a
  larger read budget needs longer cases before it ships.
- The latency line counts calls slower than each candidate production timeout.

## Baseline (2026-09-19, `jev-1.13.0`)

| kind                  | ≥0.5 | ≥0.7 | ≥0.9 |
| --------------------- | ---- | ---- | ---- |
| message benign        | 0.00 | 0.00 | 0.00 |
| message benign-hard   | 0.09 | 0.00 | 0.00 |
| message injection     | 0.96 | 0.96 | 0.74 |
| message inappropriate | 1.00 | 1.00 | 0.92 |
| page benign           | 0.00 | 0.00 | 0.00 |
| page benign-hard      | 0.00 | 0.00 | 0.00 |
| page injected         | 1.00 | 1.00 | 0.95 |

Messages p50 0.25 s, p95 0.59 s; pages p50 0.26 s, p95 0.35 s; no call over 0.65 s
in 128. The one miss at 0.7 asks for the tool definitions as JSON (0.32).
Grading a 16k page in 4k windows gave the same probabilities as one call, so the
provider makes one call.

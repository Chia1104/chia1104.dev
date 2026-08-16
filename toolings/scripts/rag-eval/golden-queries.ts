import type { Locale } from "@chia/db/types";

/**
 * `kind` groups queries by which retrieval path they stress, so a regression
 * shows *where* quality moved, not just that it moved:
 *
 * - `paraphrase` — describes the topic without the article's own words; the
 *   semantic path has to carry it.
 * - `term`       — an exact identifier / error message; the lexical path has
 *   to carry it.
 * - `heading`    — the answer lives under a heading whose words do not repeat
 *   in the section body. Currently the weakest case: heading text is not part
 *   of chunk content.
 */
export type GoldenQueryKind = "paraphrase" | "term" | "heading";

export interface GoldenQuery {
  /** stable id, used to reference a query in reports and diffs */
  id: string;
  query: string;
  /** omit to exercise the no-locale (cross-locale dedupe) path */
  locale?: Locale;
  /** feed slugs that count as relevant; usually exactly one */
  expected: string[];
  /**
   * Case-insensitive substring the hit's best-chunk `headingPath` must
   * contain, for queries whose answer lives in one specific section. Measures
   * citation quality: the document can rank #1 while the chunk shown as the
   * match is the wrong one (typically the card, when the heading words are
   * absent from the section body).
   */
  expectedHeading?: string;
  kind: GoldenQueryKind;
}

/**
 * Golden retrieval queries against the real corpus.
 *
 * Maintenance: every slug here must exist as a published feed — the runner
 * fails fast on a slug it cannot resolve, so a renamed or deleted post breaks
 * the eval loudly instead of silently deflating recall. When writing a new
 * post that is an obvious retrieval target, add a query for it.
 */
export const GOLDEN_QUERIES: GoldenQuery[] = [
  // ── zh-TW · paraphrase ────────────────────────────────────────────────
  {
    id: "zh-pg-semantic-search",
    query: "如何用 Postgres 實作語意搜尋",
    locale: "zh-TW",
    expected: ["vector-search-embedding-postgres-implementation"],
    kind: "paraphrase",
  },
  {
    id: "zh-cors-blocked",
    query: "API 被 CORS 擋住該怎麼辦",
    locale: "zh-TW",
    expected: ["how-to-solve-cors-issues"],
    kind: "paraphrase",
  },
  {
    id: "zh-chat-streaming",
    query: "AI 聊天室要即時串流回覆該用什麼技術",
    locale: "zh-TW",
    expected: ["simple-ai-chat-bot-sse-vs-websocket"],
    kind: "paraphrase",
  },
  {
    id: "zh-agent-sandbox",
    query: "讓 coding agent 在隔離的環境裡執行",
    locale: "zh-TW",
    expected: ["docker-sandboxes-agent-isolation"],
    kind: "paraphrase",
  },
  {
    id: "zh-wallet-login",
    query: "用錢包簽名登入 Ethereum",
    locale: "zh-TW",
    expected: ["web3-wallet-login"],
    kind: "paraphrase",
  },
  {
    id: "zh-site-under-attack",
    query: "網站被惡意流量攻擊怎麼用 Cloudflare 擋",
    locale: "zh-TW",
    expected: ["website-attack-cloudflare-protection"],
    kind: "paraphrase",
  },
  {
    id: "zh-gitignore-ignored",
    query: "gitignore 加了檔案還是被 git 追蹤",
    locale: "zh-TW",
    expected: ["git-file-update-tracking-issue"],
    kind: "paraphrase",
  },
  {
    id: "zh-mac-port-usage",
    query: "Mac 上查哪個程式佔用 port",
    locale: "zh-TW",
    expected: ["how-to-check-used-ports-on-mac"],
    kind: "paraphrase",
  },
  {
    id: "zh-rsc-vs-ssr",
    query: "React Server Component 跟 SSR 是什麼關係",
    locale: "zh-TW",
    expected: ["what-is-rsc-and-its-relationship-with-ssr"],
    kind: "paraphrase",
  },
  {
    id: "zh-rsc-client-state",
    query: "從 client 端更新 server component 的狀態",
    locale: "zh-TW",
    expected: ["update-rsc-state-from-client"],
    kind: "paraphrase",
  },
  {
    id: "zh-jwt-vs-session",
    query: "JWT 跟 session cookie 登入方式的差別",
    locale: "zh-TW",
    expected: ["jwt-vs-session-cookie-authentication-differences"],
    kind: "paraphrase",
  },
  {
    id: "zh-storage-difference",
    query: "localStorage 和 cookie 差在哪",
    locale: "zh-TW",
    expected: ["localstorage-sessionstorage-cookie-difference"],
    kind: "paraphrase",
  },
  {
    id: "zh-hydration-error",
    query: "hydration error 發生原因跟解法",
    locale: "zh-TW",
    expected: ["nextjs-hydration-errors-explained-solutions"],
    kind: "paraphrase",
  },

  // ── zh-TW · term ──────────────────────────────────────────────────────
  {
    id: "zh-feturbulence",
    query: "feTurbulence 做雜訊背景",
    locale: "zh-TW",
    expected: ["svg-noise-background-with-feturbulence-"],
    kind: "term",
  },
  {
    id: "zh-exec-format-error",
    query: "exec format error 部署失敗",
    locale: "zh-TW",
    expected: ["zeabur-bun-compile-binary-pitfalls"],
    kind: "term",
  },
  {
    id: "zh-forwardref-generic",
    query: "forwardRef 泛型型別安全",
    locale: "zh-TW",
    expected: ["react-forwardref-generic-type-safety"],
    kind: "term",
  },
  {
    id: "zh-pnpm-catalog",
    query: "pnpm workspace catalog 管理套件版本",
    locale: "zh-TW",
    expected: ["tips-for-managing-node-and-bun-projects-with-pnpm"],
    kind: "term",
  },
  {
    id: "zh-turborepo-trpc",
    query: "用 Turborepo 和 tRPC 重構網站",
    locale: "zh-TW",
    expected: ["tech-stack-restructure-2024"],
    kind: "term",
  },

  // ── zh-TW · heading ───────────────────────────────────────────────────
  // The relevant content sits under a heading; the section body largely does
  // not repeat the heading's words.
  {
    id: "zh-csrf",
    query: "CSRF 跨站請求偽造是什麼",
    locale: "zh-TW",
    expected: ["localstorage-sessionstorage-cookie-difference"],
    expectedHeading: "CSRF",
    kind: "heading",
  },
  {
    id: "zh-csp",
    query: "CSP 能防止哪些攻擊",
    locale: "zh-TW",
    expected: ["localstorage-sessionstorage-cookie-difference"],
    expectedHeading: "CSP",
    kind: "heading",
  },
  {
    id: "zh-t3-env",
    query: "T3 Env 環境變數驗證在做什麼",
    locale: "zh-TW",
    expected: ["2026-full-stack-web-development-tech-stack-overview"],
    expectedHeading: "T3 Env",
    kind: "heading",
  },
  {
    id: "zh-hydrate-root",
    query: "hydrateRoot 怎麼用",
    locale: "zh-TW",
    expected: ["nextjs-hydration-errors-explained-solutions"],
    expectedHeading: "hydrateRoot",
    kind: "heading",
  },
  {
    id: "zh-eventsource",
    query: "用原生 EventSource 接 SSE",
    locale: "zh-TW",
    expected: ["simple-ai-chat-bot-sse-vs-websocket"],
    expectedHeading: "EventSource",
    kind: "heading",
  },
  {
    id: "zh-sandbox-kernel",
    query: "Docker sandbox 的 kernel 隔離差異",
    locale: "zh-TW",
    expected: ["docker-sandboxes-agent-isolation"],
    expectedHeading: "Kernel",
    kind: "heading",
  },

  // ── hard paraphrases — no content words shared with the article ───────
  {
    id: "zh-hard-flicker",
    query: "頁面載入時內容閃一下就跳掉",
    locale: "zh-TW",
    expected: ["nextjs-hydration-errors-explained-solutions"],
    kind: "paraphrase",
  },
  {
    id: "zh-hard-token-storage",
    query: "登入 token 放在哪裡比較安全",
    locale: "zh-TW",
    expected: ["localstorage-sessionstorage-cookie-difference"],
    kind: "paraphrase",
  },
  {
    id: "zh-hard-monorepo-share",
    query: "很多專案要共用同一份程式碼怎麼管理",
    locale: "zh-TW",
    expected: ["tips-for-managing-node-and-bun-projects-with-pnpm"],
    kind: "paraphrase",
  },
  {
    id: "en-hard-server-push",
    query: "push updates from the server to the browser without websockets",
    locale: "en",
    expected: ["simple-ai-chat-bot-sse-vs-websocket"],
    kind: "paraphrase",
  },

  // ── en ────────────────────────────────────────────────────────────────
  {
    id: "en-jwt-vs-session",
    query: "difference between JWT and session cookie authentication",
    locale: "en",
    expected: ["jwt-vs-session-cookie-authentication-differences"],
    kind: "paraphrase",
  },
  {
    id: "en-pgvector",
    query: "implement semantic search with pgvector",
    locale: "en",
    expected: ["vector-search-embedding-postgres-implementation"],
    kind: "paraphrase",
  },
  {
    id: "en-hydration-why",
    query: "why do hydration mismatches happen in Next.js",
    locale: "en",
    expected: ["nextjs-hydration-errors-explained-solutions"],
    kind: "paraphrase",
  },
  {
    id: "en-agent-sandbox",
    query: "run Claude Code safely in an isolated sandbox",
    locale: "en",
    expected: ["docker-sandboxes-agent-isolation"],
    kind: "paraphrase",
  },
  {
    id: "en-rsc-share-function",
    query: "share a function between client and server components",
    locale: "en",
    expected: ["react-server-module-conventions"],
    kind: "paraphrase",
  },
  {
    id: "en-cloudflare",
    query: "protect a website from attacks with Cloudflare",
    locale: "en",
    expected: ["website-attack-cloudflare-protection"],
    kind: "paraphrase",
  },

  // ── no locale (cross-locale dedupe path) ──────────────────────────────
  {
    id: "any-zeabur-bun",
    query: "zeabur bun compile binary",
    expected: ["zeabur-bun-compile-binary-pitfalls"],
    kind: "term",
  },
  {
    id: "any-pnpm-workspace",
    query: "pnpm workspace",
    expected: ["tips-for-managing-node-and-bun-projects-with-pnpm"],
    kind: "term",
  },
];

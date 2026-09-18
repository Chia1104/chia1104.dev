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
 * - `confusable` — several posts share the topic and only one answers; read
 *   R@1, since the neighbours fill the top 5 either way.
 * - `multi`      — the answer spans several sections of one post; read
 *   `cover`, the share of `expectedHeadings` the hit's chunks reach.
 * - `cross`      — the query is not in the locale it searches, so only the
 *   semantic path can carry it; bm25 is expected to miss.
 * - `memory`     — searches the agent's stored pages instead of posts, the way
 *   `search_memory` does; `expected` holds source URLs. Long external pages
 *   on neighbouring subjects, mostly English under Chinese queries.
 *
 * A query the corpus cannot answer is not here: ranks are relative, so
 * retrieval always returns something and only an agent-level eval can tell
 * whether the model declines.
 */
export type GoldenQueryKind =
  | "paraphrase"
  | "term"
  | "heading"
  | "confusable"
  | "multi"
  | "cross"
  | "memory";

export interface GoldenQuery {
  /** stable id, used to reference a query in reports and diffs */
  id: string;
  query: string;
  /** omit to exercise the no-locale (cross-locale dedupe) path */
  locale?: Locale;
  /** feed slugs that count as relevant, or source URLs for a `memory` query; usually exactly one */
  expected: string[];
  /**
   * Case-insensitive substring the hit's best-chunk `headingPath` must
   * contain, for queries whose answer lives in one specific section. Measures
   * citation quality: the document can rank #1 while the chunk shown as the
   * match is the wrong one (typically the card, when the heading words are
   * absent from the section body).
   */
  expectedHeading?: string;
  /**
   * Case-insensitive substrings, each of which some chunk of the hit should
   * sit under. Measures whether one search reaches every section the answer
   * needs, which is what saves an agent a second search for the same post.
   */
  expectedHeadings?: string[];
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
    expectedHeading: "如何 Hydration",
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

  // ── zh-TW · confusable ────────────────────────────────────────────────
  {
    id: "zh-conf-rsc-serializable-props",
    query: "Server Component 可以傳哪些型別的 props 給 Client Component",
    locale: "zh-TW",
    expected: ["update-rsc-state-from-client"],
    kind: "confusable",
  },
  {
    id: "zh-conf-rsc-streaming",
    query: "RSC 的結果是怎麼序列化後串流到瀏覽器的",
    locale: "zh-TW",
    expected: ["what-is-rsc-and-its-relationship-with-ssr"],
    kind: "confusable",
  },
  {
    id: "zh-conf-rsc-shared-function",
    query: "同一個 function 想在 client 跟 server component 各給一份實作",
    locale: "zh-TW",
    expected: ["react-server-module-conventions"],
    kind: "confusable",
  },
  {
    id: "zh-conf-rsc-search-params",
    query: "用網址的 query string 讓 server component 重新渲染",
    locale: "zh-TW",
    expected: ["update-rsc-state-from-client"],
    kind: "confusable",
  },
  {
    id: "zh-conf-render-twice",
    query: "為什麼同一個元件在伺服器跟瀏覽器都會跑一次",
    locale: "zh-TW",
    expected: ["nextjs-hydration-errors-explained-solutions"],
    kind: "confusable",
  },
  {
    id: "zh-conf-better-auth",
    query: "為什麼不繼續用 NextAuth 而換成 Better Auth",
    locale: "zh-TW",
    expected: ["tech-stack-restructure-2024"],
    kind: "confusable",
  },
  {
    id: "zh-conf-drizzle-prisma",
    query: "Drizzle 跟 Prisma 的比較",
    locale: "zh-TW",
    expected: ["tech-stack-restructure-2024"],
    kind: "confusable",
  },
  {
    id: "zh-conf-migration-up-down",
    query: "migration 的 up 跟 down 分別要寫什麼",
    locale: "zh-TW",
    expected: ["2026-full-stack-web-development-tech-stack-overview"],
    kind: "confusable",
  },
  {
    id: "zh-conf-durable-queue",
    query: "不想自己維護 message queue 跟 retry 邏輯的背景工作",
    locale: "zh-TW",
    expected: ["2026-full-stack-web-development-tech-stack-overview"],
    kind: "confusable",
  },
  {
    id: "zh-conf-world-module-not-found",
    query: "Nitro 用 Docker 部署後找不到 workflow world 的模組",
    locale: "zh-TW",
    expected: ["workflow-develop-kit-world-module-not-found-issue"],
    kind: "confusable",
  },
  {
    id: "zh-conf-build-vs-runtime-env",
    query: "build time 跟 runtime 的環境變數差在哪",
    locale: "zh-TW",
    expected: ["env-secrets-management"],
    kind: "confusable",
  },
  {
    id: "zh-conf-zeabur-incident",
    query: "Zeabur 的環境變數外洩事件",
    locale: "zh-TW",
    expected: ["env-secrets-management"],
    kind: "confusable",
  },
  {
    id: "zh-conf-secret-rotation",
    query: "金鑰外洩之後要怎麼輪替跟撤銷",
    locale: "zh-TW",
    expected: ["env-secrets-management"],
    kind: "confusable",
  },
  {
    id: "zh-conf-cloudflare-worker-secret",
    query: "在 Cloudflare Worker 裡讀取 secret",
    locale: "zh-TW",
    expected: ["env-secrets-management"],
    kind: "confusable",
  },
  {
    id: "zh-conf-cloudflare-waf-seo",
    query: "用 Cloudflare 擋惡意流量但不要擋到搜尋引擎的爬蟲",
    locale: "zh-TW",
    expected: ["website-attack-cloudflare-protection"],
    kind: "confusable",
  },
  {
    id: "zh-conf-agent-handoff",
    query: "把任務交給 AI agent 之前要先準備什麼",
    locale: "zh-TW",
    expected: ["ai-agent-development-workflow"],
    kind: "confusable",
  },
  {
    id: "zh-conf-agent-network-policy",
    query: "限制 agent 只能連到特定網站",
    locale: "zh-TW",
    expected: ["docker-sandboxes-agent-isolation"],
    kind: "confusable",
  },
  {
    id: "zh-conf-cron-replicas",
    query: "服務開多個 replica 之後排程工作被重複執行",
    locale: "zh-TW",
    expected: ["ai-agent-development-workflow"],
    kind: "confusable",
  },
  {
    id: "zh-conf-useeffect-setstate",
    query: "在 useEffect 裡面呼叫 setState 的問題",
    locale: "zh-TW",
    expected: ["ai-agent-development-workflow"],
    kind: "confusable",
  },
  {
    id: "zh-conf-editor-autocomplete",
    query: "編輯器的自動補全跟跳轉定義是誰算出來的",
    locale: "zh-TW",
    expected: ["typescript-tsserver-lsp-development-mindset"],
    kind: "confusable",
  },

  // ── zh-TW · multi ─────────────────────────────────────────────────────
  {
    id: "zh-multi-vector-distance-index",
    query: "餘弦相似度跟歐幾里德距離差在哪，建索引時又該怎麼選",
    locale: "zh-TW",
    expected: ["vector-search-embedding-postgres-implementation"],
    expectedHeadings: [
      "Cosine Similarity",
      "Euclidean Distance",
      "索引選擇建議",
    ],
    kind: "multi",
  },
  {
    id: "zh-multi-csrf-csp",
    query: "CSRF 跟 CSP 分別在防什麼攻擊",
    locale: "zh-TW",
    expected: ["localstorage-sessionstorage-cookie-difference"],
    expectedHeadings: ["CSRF", "CSP"],
    kind: "multi",
  },
  {
    id: "zh-multi-jwt-session-compare",
    query: "JWT 跟 session 各自怎麼運作，最後該怎麼選",
    locale: "zh-TW",
    expected: ["jwt-vs-session-cookie-authentication-differences"],
    expectedHeadings: ["JWT", "Session Cookie", "兩者比較"],
    kind: "multi",
  },
  {
    id: "zh-multi-env-build-runtime-injection",
    query:
      "build-time 跟 runtime 變數的差別，以及 production 要怎麼注入 secret",
    locale: "zh-TW",
    expected: ["env-secrets-management"],
    expectedHeadings: [
      "Build-time environment variable",
      "Runtime environment variable",
      "Secret injection",
    ],
    kind: "multi",
  },
  {
    id: "zh-multi-sse-websocket-eventsource",
    query: "SSE 跟 WebSocket 的協議差異，還有前端怎麼用 EventSource 接",
    locale: "zh-TW",
    expected: ["simple-ai-chat-bot-sse-vs-websocket"],
    expectedHeadings: ["協議特性差異", "EventSource"],
    kind: "multi",
  },
  {
    id: "zh-multi-sandbox-files-network",
    query: "sandbox 裡的檔案怎麼進出，網路又是怎麼限制的",
    locale: "zh-TW",
    expected: ["docker-sandboxes-agent-isolation"],
    expectedHeadings: ["檔案怎麼進出", "網路 Policy"],
    kind: "multi",
  },
  {
    id: "zh-multi-drizzle-hono",
    query: "為什麼從 Prisma 換到 Drizzle，又為什麼從 Nest.js 換到 Hono",
    locale: "zh-TW",
    expected: ["tech-stack-restructure-2024"],
    expectedHeadings: ["Drizzle", "Hono"],
    kind: "multi",
  },
  {
    id: "zh-multi-tsserver-lsp",
    query: "tsserver 怎麼跟編輯器溝通，LSP 又在傳什麼",
    locale: "zh-TW",
    expected: ["typescript-tsserver-lsp-development-mindset"],
    expectedHeadings: ["tsserver 如何跟編輯器溝通", "LSP 在傳什麼"],
    kind: "multi",
  },
  {
    id: "zh-multi-rsc-pros-cons",
    query: "RSC 帶來哪些優勢，又有哪些挑戰",
    locale: "zh-TW",
    expected: ["what-is-rsc-and-its-relationship-with-ssr"],
    expectedHeadings: ["優勢", "挑戰"],
    kind: "multi",
  },
  {
    id: "zh-multi-agent-mistakes",
    query: "agent 誤解 API 型別，還有 CRON 在多 replica 下出錯的例子",
    locale: "zh-TW",
    expected: ["ai-agent-development-workflow"],
    expectedHeadings: ["onUploadProgress", "CRON job"],
    kind: "multi",
  },

  // ── cross · query language differs from the locale searched ───────────
  {
    id: "cross-en-zh-hydration",
    query: "how to fix a hydration mismatch in Next.js",
    locale: "zh-TW",
    expected: ["nextjs-hydration-errors-explained-solutions"],
    kind: "cross",
  },
  {
    id: "cross-en-zh-jwt-session",
    query: "difference between JWT and session cookie authentication",
    locale: "zh-TW",
    expected: ["jwt-vs-session-cookie-authentication-differences"],
    kind: "cross",
  },
  {
    id: "cross-en-zh-gitignore",
    query: "why is my gitignore rule not taking effect",
    locale: "zh-TW",
    expected: ["git-file-update-tracking-issue"],
    kind: "cross",
  },
  {
    id: "cross-en-zh-agent-sandbox",
    query: "isolated environment for running coding agents safely",
    locale: "zh-TW",
    expected: ["docker-sandboxes-agent-isolation"],
    kind: "cross",
  },
  {
    id: "cross-en-zh-secrets",
    query: "why env files are not secrets management",
    locale: "zh-TW",
    expected: ["env-secrets-management"],
    kind: "cross",
  },
  {
    id: "cross-zh-en-semantic-search",
    query: "如何用 Postgres 實作語意搜尋",
    locale: "en",
    expected: ["vector-search-embedding-postgres-implementation"],
    kind: "cross",
  },
  {
    id: "cross-zh-en-site-attack",
    query: "網站被攻擊時怎麼用 Cloudflare 防護",
    locale: "en",
    expected: ["website-attack-cloudflare-protection"],
    kind: "cross",
  },
  {
    id: "cross-zh-en-package-versions",
    query: "monorepo 裡統一管理套件版本",
    locale: "en",
    expected: ["tips-for-managing-node-and-bun-projects-with-pnpm"],
    kind: "cross",
  },
  {
    id: "cross-zh-en-rsc-ssr",
    query: "伺服器元件跟伺服器端渲染是什麼關係",
    locale: "en",
    expected: ["what-is-rsc-and-its-relationship-with-ssr"],
    kind: "cross",
  },
  {
    id: "cross-zh-en-agent-workflow",
    query: "使用 AI agent 開發的方式有什麼轉變",
    locale: "en",
    expected: ["ai-agent-development-workflow"],
    kind: "cross",
  },

  // ── memory · the agent's stored pages ────────────────────────────────
  {
    id: "mem-pi-sessions",
    query: "Pi 的 session 檔案是什麼格式，compaction 之後舊的歷史還在嗎",
    expected: [
      "https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/docs/sessions.md",
    ],
    kind: "memory",
  },
  {
    id: "mem-pi-extensions",
    query: "替 Pi coding agent 寫自己的 extension",
    expected: [
      "https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/docs/extensions.md",
    ],
    kind: "memory",
  },
  {
    id: "mem-zeabur-incident",
    query: "Zeabur 專案未授權存取事件的官方公告",
    expected: ["https://status.zeabur.com/incident/1037896"],
    kind: "memory",
  },
  {
    id: "mem-owasp-secrets",
    query: "OWASP 對 secrets 管理的建議清單",
    expected: [
      "https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html",
    ],
    kind: "memory",
  },
  {
    id: "mem-azure-secrets",
    query: "Microsoft 對保護 secrets 的最佳實務",
    expected: [
      "https://learn.microsoft.com/en-us/azure/security/fundamentals/secrets-best-practices",
    ],
    kind: "memory",
  },
  {
    id: "mem-cf-secret-binding",
    query: "Worker 要怎麼綁定 Secrets Store 裡的 secret",
    expected: [
      "https://developers.cloudflare.com/secrets-store/integrations/workers/",
    ],
    kind: "memory",
  },
  {
    id: "mem-redis-delivery",
    query: "Redis pub/sub 的訊息會不會遺失，傳遞保證是什麼",
    expected: ["https://redis.io/docs/latest/develop/pubsub/"],
    kind: "memory",
  },
  {
    id: "mem-workflow-webhook",
    query: "workflow 暫停下來等外部系統回呼再繼續",
    expected: ["https://workflow-sdk.dev/docs/foundations/hooks"],
    kind: "memory",
  },
  {
    id: "mem-workflow-create-webhook",
    query: "createWebhook",
    expected: ["https://workflow-sdk.dev/docs/foundations/hooks"],
    kind: "memory",
  },
  {
    id: "mem-world-redis",
    query: "workflow 的 redis world 套件怎麼設定",
    expected: [
      "https://github.com/mizzle-dev/workflow-worlds/tree/main/packages/redis",
    ],
    kind: "memory",
  },
  {
    id: "mem-ioredis-cluster",
    query: "用 ioredis 連 Redis Cluster",
    expected: ["https://github.com/redis/ioredis"],
    kind: "memory",
  },
  {
    id: "mem-stripe-idempotency",
    query: "重送同一個 POST 請求時怎麼避免重複扣款",
    expected: ["https://docs.stripe.com/api/idempotent_requests"],
    kind: "memory",
  },
  {
    id: "mem-rfc-idempotent-methods",
    query: "HTTP 規範裡哪些 method 被定義為 idempotent",
    expected: ["https://www.rfc-editor.org/rfc/rfc9110"],
    kind: "memory",
  },
  {
    id: "mem-tokenizer-lazy-load",
    query: "為什麼 tokenizer 要延遲載入",
    expected: [
      "https://github.com/Chia1104/chia1104.dev/blob/develop/packages/ai/src/embeddings/tokenizer.ts",
    ],
    kind: "memory",
  },
];

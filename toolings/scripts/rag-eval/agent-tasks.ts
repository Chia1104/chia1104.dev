/**
 * Tasks for the agent-level eval: one visitor question each, run as a real public-kind turn.
 *
 * Every check is deterministic; there is no model judge. A task passes when the turn ends
 * without an error, stays within the kind's tool budget, links only posts a tool returned,
 * and meets its own expectations below.
 */
export interface AgentTask {
  id: string;
  prompt: string;
  /** Slugs the answer must link. */
  expectedSlugs?: string[];
  /** Tools the turn must call at least once. */
  expectedTools?: string[];
  /** Argument names some call of `expectedTools[0]` must carry, e.g. a date filter. */
  expectedArguments?: string[];
  /** Substrings the answer must contain, e.g. a count. */
  expectedText?: string[];
  /** Most `search_posts` calls allowed: a second search for a post already found is the waste multi-section hits remove. */
  maxSearches?: number;
  /** The corpus has no answer: the answer must say so and link nothing as one. */
  unanswerable?: boolean;
}

export const AGENT_TASKS: AgentTask[] = [
  {
    id: "single-vector-search",
    prompt: "作者是怎麼用 Postgres 實作語意搜尋的？",
    expectedSlugs: ["vector-search-embedding-postgres-implementation"],
    expectedTools: ["search_posts"],
  },
  {
    id: "confusable-build-runtime-env",
    prompt: "build time 跟 runtime 的環境變數差在哪？",
    expectedSlugs: ["env-secrets-management"],
    expectedTools: ["search_posts"],
  },
  {
    id: "multi-jwt-session",
    prompt: "JWT 跟 session cookie 各自怎麼運作，最後該怎麼選？",
    expectedSlugs: ["jwt-vs-session-cookie-authentication-differences"],
    expectedTools: ["search_posts", "get_post"],
    maxSearches: 2,
  },
  {
    id: "cross-hydration",
    prompt: "How does the author fix hydration errors in Next.js?",
    expectedSlugs: ["nextjs-hydration-errors-explained-solutions"],
    expectedTools: ["search_posts"],
  },
  {
    id: "count-2025",
    prompt: "2025 年總共發佈了幾篇內容（文章加筆記）？",
    expectedTools: ["list_posts"],
    expectedArguments: ["createdFrom", "createdBefore"],
    expectedText: ["11"],
  },
  {
    id: "count-notes",
    prompt: "目前總共有幾篇 note？",
    expectedTools: ["list_posts"],
    expectedArguments: ["type"],
    expectedText: ["10"],
  },
  {
    id: "latest-post",
    prompt: "最新發佈的一篇是什麼？",
    expectedSlugs: ["ai-agent-development-workflow"],
    expectedTools: ["list_posts"],
  },
  {
    id: "unanswerable-k8s-operator",
    prompt: "作者有寫過怎麼開發 Kubernetes operator 的文章嗎？",
    expectedTools: ["search_posts"],
    unanswerable: true,
  },
];

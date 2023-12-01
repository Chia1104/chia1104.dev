import { env } from "@/env.mjs";
import type { GiscusProps } from "@giscus/react";

export const giscusConfig = {
  repo: env.NEXT_PUBLIC_GISCUS_REPO as GiscusProps["repo"],
  repoId: env.NEXT_PUBLIC_GISCUS_REPO_ID!,
  category: env.NEXT_PUBLIC_GISCUS_CATEGORY,
  categoryId: env.NEXT_PUBLIC_GISCUS_CATEGORY_ID,
  theme: env.NEXT_PUBLIC_GISCUS_THEME,
} satisfies Partial<GiscusProps>;

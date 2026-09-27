"use client";

import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { CopyButton } from "@chia/ui/copy-button";
import { cn } from "@chia/ui/utils/cn.util";

import LocaleSelector from "@/components/commons/locale-selector";

import { OpenInChat } from "./open-in-chat";

/**
 * The article's markdown from its `llm.md`, kept out of the page so the body is not
 * serialized twice. Nothing fetches it on mount: `llm.md` is a function call per request.
 */
const articleMarkdownOptions = (articleUrl: string) => {
  const path = new URL(articleUrl).pathname;
  return queryOptions({
    queryKey: ["article-markdown", path],
    queryFn: async ({ signal }) => {
      const response = await fetch(path, { signal });
      if (!response.ok) {
        throw new Error(`Article markdown failed with HTTP ${response.status}`);
      }
      return response.text();
    },
    staleTime: Infinity,
  });
};

export const ActionGroup = ({
  articleUrl,
  className,
}: {
  /** The article's `llm.md`. */
  articleUrl: string;
  className?: string;
}) => {
  const tAction = useTranslations("action");
  const queryClient = useQueryClient();
  const markdown = articleMarkdownOptions(articleUrl);
  // Observes the fetch that hover or press starts.
  const { data, isFetching } = useQuery({ ...markdown, enabled: false });

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <LocaleSelector />
      <CopyButton
        // Prefetched on hover, a press usually finds the text and copies it synchronously.
        {...(data === undefined
          ? { loadContent: () => queryClient.fetchQuery(markdown) }
          : { content: data })}
        onHoverStart={() => queryClient.prefetchQuery(markdown)}
        isPending={isFetching}
        iconProps={{
          className: "size-4",
        }}
        translations={{
          copied: tAction("copied"),
          copy: tAction("copy"),
        }}
        variant="tertiary"
      />
      <OpenInChat articleUrl={articleUrl} />
    </div>
  );
};

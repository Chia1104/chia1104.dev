"use client";

import { useTranslations } from "next-intl";

import { CopyButton } from "@chia/ui/copy-button";
import { cn } from "@chia/ui/utils/cn.util";

import LocaleSelector from "@/components/commons/locale-selector";

import { OpenInChat } from "./open-in-chat";

/** Fetched on copy from `articleUrl`, so the article body is not serialized into the page twice. */
const fetchMarkdown = async (articleUrl: string) => {
  const response = await fetch(new URL(articleUrl).pathname);
  if (!response.ok) {
    throw new Error(`Article markdown failed with HTTP ${response.status}`);
  }
  return response.text();
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
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <LocaleSelector />
      <CopyButton
        loadContent={() => fetchMarkdown(articleUrl)}
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

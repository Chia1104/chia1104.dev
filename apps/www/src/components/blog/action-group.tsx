"use client";

import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { CopyButton } from "@chia/ui/copy-button";
import { cn } from "@chia/ui/utils/cn.util";

import LocaleSelector from "@/components/commons/locale-selector";

import { OpenInChat } from "./open-in-chat";

export const ActionGroup = ({
  articleUrl,
  className,
}: {
  /** The article's `llm.md`. */
  articleUrl: string;
  className?: string;
}) => {
  const tAction = useTranslations("action");
  // Fetched on press, so the article body is not serialized into the page twice.
  const markdown = useMutation({
    mutationFn: async () => {
      const response = await fetch(new URL(articleUrl).pathname);
      if (!response.ok) {
        throw new Error(`Article markdown failed with HTTP ${response.status}`);
      }
      return response.text();
    },
  });

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <LocaleSelector />
      <CopyButton
        loadContent={() => markdown.mutateAsync()}
        isPending={markdown.isPending}
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

"use client";

import { useTranslations } from "next-intl";

import { CopyButton } from "@chia/ui/copy-button";
import { cn } from "@chia/ui/utils/cn.util";

import LocaleSelector from "@/components/commons/locale-selector";

import { OpenInChat } from "./open-in-chat";

export const ActionGroup = ({
  content,
  articleUrl,
  className,
}: {
  content?: string | null;
  articleUrl: string;
  className?: string;
}) => {
  const tAction = useTranslations("action");
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <LocaleSelector />
      {content ? (
        <CopyButton
          content={content}
          iconProps={{
            className: "size-4",
          }}
          translations={{
            copied: tAction("copied"),
            copy: tAction("copy"),
          }}
          variant="tertiary"
        />
      ) : null}
      <OpenInChat articleUrl={articleUrl} />
    </div>
  );
};

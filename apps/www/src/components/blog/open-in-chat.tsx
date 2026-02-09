"use client";

import { useTranslations } from "next-intl";

import {
  OpenIn,
  OpenInChatGPT,
  OpenInClaude,
  OpenInContent,
  OpenInCursor,
  OpenInScira,
  OpenInT3,
  OpenInTrigger,
  OpenInv0,
  providers,
} from "@chia/ui/open-in-chat";

export const OpenInChat = ({ articleUrl }: { articleUrl: string }) => {
  const t = useTranslations("blog");
  return (
    <OpenIn
      query={t("open-in-chat-query", {
        url: articleUrl,
      })}
      providers={{
        ...providers,
        chatgpt: {
          ...providers.chatgpt,
          title: t("open-in-chatgpt"),
        },
        claude: {
          ...providers.claude,
          title: t("open-in-claude"),
        },
        cursor: {
          ...providers.cursor,
          title: t("open-in-cursor"),
        },
        t3: {
          ...providers.t3,
          title: t("open-in-t3"),
        },
        scira: {
          ...providers.scira,
          title: t("open-in-scira"),
        },
        v0: {
          ...providers.v0,
          title: t("open-in-v0"),
        },
      }}>
      <OpenInTrigger className="max-w-fit" label={t("open-in-chat")} />
      <OpenInContent className="not-prose min-w-55">
        <OpenInChatGPT />
        <OpenInClaude />
        <OpenInCursor />
        <OpenInT3 />
        <OpenInScira />
        <OpenInv0 />
      </OpenInContent>
    </OpenIn>
  );
};

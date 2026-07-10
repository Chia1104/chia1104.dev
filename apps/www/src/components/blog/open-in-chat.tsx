"use client";

import { useTranslations } from "next-intl";

import {
  OpenIn,
  OpenInChatGPT,
  OpenInClaude,
  OpenInContent,
  OpenInPerplexity,
  OpenInT3,
  OpenInTrigger,
  OpenInMarkdown,
  OpenInGemini,
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
        markdown: {
          ...providers.markdown,
          createUrl: () => articleUrl,
          title: t("view-as-markdown"),
        },
        chatgpt: {
          ...providers.chatgpt,
          title: t("open-in-chatgpt"),
        },
        claude: {
          ...providers.claude,
          title: t("open-in-claude"),
        },
        gemini: {
          ...providers.gemini,
          title: t("open-in-gemini"),
        },
        t3: {
          ...providers.t3,
          title: t("open-in-t3"),
        },
        perplexity: {
          ...providers.perplexity,
          title: t("open-in-perplexity"),
        },
      }}>
      <OpenInTrigger className="max-w-fit" label={t("open-in-chat")} />
      <OpenInContent className="not-prose min-w-55">
        <OpenInMarkdown />
        <OpenInChatGPT />
        <OpenInClaude />
        <OpenInGemini />
        <OpenInT3 />
        <OpenInPerplexity />
      </OpenInContent>
    </OpenIn>
  );
};

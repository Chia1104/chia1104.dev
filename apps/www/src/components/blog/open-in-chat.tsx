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
  Provider,
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
        [Provider.Markdown]: {
          ...providers[Provider.Markdown],
          createUrl: () => articleUrl,
          title: t("view-as-markdown"),
        },
        [Provider.ChatGPT]: {
          ...providers[Provider.ChatGPT],
          title: t("open-in-chatgpt"),
        },
        [Provider.Claude]: {
          ...providers[Provider.Claude],
          title: t("open-in-claude"),
        },
        [Provider.Gemini]: {
          ...providers[Provider.Gemini],
          title: t("open-in-gemini"),
        },
        [Provider.T3]: {
          ...providers[Provider.T3],
          title: t("open-in-t3"),
        },
        [Provider.Perplexity]: {
          ...providers[Provider.Perplexity],
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

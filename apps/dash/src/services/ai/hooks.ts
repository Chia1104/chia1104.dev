"use client";

import { useCompletion } from "ai/react";

import type { BaseRequest } from "@chia/ai/types";
import { OpenAIModal } from "@chia/ai/types";
import { getServiceEndPoint } from "@chia/utils";

type UseCompletionOptions = Parameters<typeof useCompletion>[0];

export const useGenerateFeedSlug = (
  input: { title: string },
  options?: Partial<UseCompletionOptions>
) => {
  return useCompletion({
    api: `${getServiceEndPoint()}/ai/generate`,
    credentials: "include",
    id: "ai-generate-feed-slug",
    streamProtocol: "text",
    body: {
      modal: OpenAIModal["gpt-4o-mini"],
      messages: [{ role: "user", content: input.title }],
      system:
        "Please help me generate a feed slug based on this title." +
        "And only return the value of the feed slug." +
        "The slug should be unique and easy to remember." +
        "only use english characters and numbers.",
    } satisfies Omit<BaseRequest, "authToken">,
    ...options,
  });
};

export const useGenerateFeedDescription = (
  input: string,
  options?: Partial<UseCompletionOptions>
) => {
  return useCompletion({
    api: `${getServiceEndPoint()}/ai/generate`,
    credentials: "include",
    id: "ai-generate-feed-description",
    streamProtocol: "text",
    body: {
      modal: OpenAIModal["gpt-4o-mini"],
      messages: [{ role: "user", content: input }],
      system:
        "Please help me generate a feed description based on this content." +
        "And only return the value of the feed description." +
        "The description should be concise and easy to read." +
        "ten internationalization should be match the content.",
    } satisfies Omit<BaseRequest, "authToken">,
    ...options,
  });
};

export const useGenerateFeedContent = (
  input: { title?: string; description?: string; content: string },
  options?: Partial<UseCompletionOptions>
) => {
  return useCompletion({
    api: `${getServiceEndPoint()}/ai/generate`,
    credentials: "include",
    id: "ai-generate-feed-content",
    streamProtocol: "text",
    body: {
      modal: OpenAIModal["gpt-4o-mini"],
      messages: [
        { role: "user", content: `my current title is ${input.title ?? ""}` },
        {
          role: "user",
          content: `my current description is ${input.description ?? ""}`,
        },
        { role: "user", content: `my current content is ${input.content}` },
      ],
    } satisfies Omit<BaseRequest, "authToken">,
    ...options,
  });
};

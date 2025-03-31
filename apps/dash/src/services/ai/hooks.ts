"use client";

import { useCompletion } from "@ai-sdk/react";

import type { BaseRequest, Modal } from "@chia/ai/types";
import { OpenAIModal, Provider } from "@chia/ai/types";
import { getServiceEndPoint } from "@chia/utils";

type UseCompletionOptions = Parameters<typeof useCompletion>[0];

export const useGenerateFeedSlug = (
  modal?: Modal,
  input?: { title: string },
  options?: Partial<UseCompletionOptions>
) => {
  return useCompletion({
    api: `${getServiceEndPoint()}/ai/generate`,
    credentials: "include",
    id: "ai-generate-feed-slug",
    streamProtocol: "data",
    body: {
      modal: modal ?? {
        provider: Provider.OpenAI,
        id: OpenAIModal["gpt-4o-mini"],
      },
      messages: [{ role: "user", content: input?.title ?? "" }],
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
  modal?: Modal,
  input?: string,
  options?: Partial<UseCompletionOptions>
) => {
  return useCompletion({
    api: `${getServiceEndPoint()}/ai/generate`,
    credentials: "include",
    id: "ai-generate-feed-description",
    streamProtocol: "data",
    body: {
      modal: modal ?? {
        provider: Provider.OpenAI,
        id: OpenAIModal["gpt-4o-mini"],
      },
      messages: [{ role: "user", content: input ?? "" }],
      system:
        "Please help me generate a feed description based on this content." +
        "And only return the value of the feed description." +
        "The description should be concise and easy to read." +
        "ten internationalization should be match the content." +
        "The content should be SEO friendly." +
        "The content should be less than 300 characters",
    } satisfies Omit<BaseRequest, "authToken">,
    ...options,
  });
};

export const useGenerateFeedContent = (
  modal?: Modal,
  input?: { title?: string; description?: string; content: string },
  options?: Partial<UseCompletionOptions>
) => {
  return useCompletion({
    api: `${getServiceEndPoint()}/ai/generate`,
    credentials: "include",
    id: "ai-generate-feed-content",
    streamProtocol: "data",
    body: {
      modal: modal ?? {
        provider: Provider.OpenAI,
        id: OpenAIModal["gpt-4o-mini"],
      },
      messages: [
        { role: "user", content: `my current title is ${input?.title ?? ""}` },
        {
          role: "user",
          content: `my current description is ${input?.description ?? ""}`,
        },
        { role: "user", content: `my current content is ${input?.content}` },
      ],
    } satisfies Omit<BaseRequest, "authToken">,
    ...options,
  });
};

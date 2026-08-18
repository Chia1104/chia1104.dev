import { parse as parseHTML } from "node-html-parser";

import type {
  CommitDraftInput,
  CommitDraftResult,
  ContentPort,
  FetchedPage,
} from "@chia/agent-writing/ports";
import { createFeedService, updateFeedService } from "@chia/api/feeds/write";
import type { DB } from "@chia/db/client";
import type { Locale } from "@chia/db/types";
import {
  ContentType as ContentTypeEnum,
  FeedType as FeedTypeEnum,
} from "@chia/db/types";
import request from "@chia/utils/request";

import { createContentReadPort } from "./content-read.port";
import { feedHooks } from "./feed-indexing.service";

/**
 * {@link ContentPort} implementation: the author-visibility read port plus outbound fetch and
 * the writes only the writing agent performs.
 *
 * Writes go through `createFeedService`/`updateFeedService` rather than their own queries, so
 * the agent is subject to the same slug generation as a human using the dashboard. Post-write
 * indexing is passed in explicitly: this runs in a workflow step with no request context to
 * carry it.
 *
 * Takes a `DB` rather than a `ServiceContext`, because it is constructed inside a
 * workflow step where no request exists. Authorisation happened at the transport boundary before
 * the run was started — the writing kind admits only the configured admin — so `adminId` is that
 * configured author, never tool input.
 */

const MAX_PAGE_CHARS = 200_000;

/** Shape the feed write services expect for one locale. */
interface TranslationPayload {
  title: string;
  excerpt: string | null;
  description: string | null;
  summary: string | null;
  content?: { content: string };
}

export interface CreateContentPortOptions {
  db: DB;
  /** The configured author the writing agent acts as; its kind admits no one else. */
  adminId: string;
}

/** Byte cap for a fetched page; `MAX_PAGE_CHARS` alone caps only after the full download. */
const MAX_PAGE_BYTES = 2 * 1024 * 1024;

/**
 * Reads the body incrementally and stops at the cap, so a huge (or unbounded) response
 * costs at most `MAX_PAGE_BYTES` of memory instead of being buffered whole before the
 * `MAX_PAGE_CHARS` slice.
 */
const readBoundedText = async (response: Response): Promise<string> => {
  const reader = response.body?.getReader();
  if (!reader) return "";

  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;

  while (bytes < MAX_PAGE_BYTES && text.length < MAX_PAGE_CHARS) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    text += decoder.decode(value, { stream: true });
  }

  await reader.cancel().catch(() => undefined);
  return text.slice(0, MAX_PAGE_CHARS);
};

export const createAgentContentPort = (
  options: CreateContentPortOptions
): ContentPort => {
  const { db, adminId } = options;

  const read = createContentReadPort({
    db,
    authorId: adminId,
    visibility: "author",
  });

  return {
    ...read,

    async fetchPage(url: string): Promise<FetchedPage> {
      const response = await request({
        headers: { Accept: "text/html,application/xhtml+xml" },
      }).get(url);
      const html = await readBoundedText(response);

      // Matches `toolings.route.ts` — a parser, not a DOM. jsdom cost ~110MB RSS on import and
      // never gave it back; all this needs is selectors and text.
      const document = parseHTML(html);

      for (const selector of ["script", "style", "noscript", "svg"]) {
        for (const node of document.querySelectorAll(selector)) node.remove();
      }

      /**
       * `document` itself is the last fallback, not `body`.
       *
       * jsdom parsed into a full document and synthesised a `<body>` even for a bare fragment.
       * A parser does not, so a response with no `<body>` wrapper would otherwise select nothing
       * and hand the model an empty page.
       */
      const main =
        document.querySelector("article") ??
        document.querySelector("main") ??
        document.querySelector("body") ??
        document;

      return {
        url,
        title: document.querySelector("title")?.textContent ?? undefined,
        // Collapse the whitespace the parser preserves; the model does not benefit from blank lines.
        text: (main?.textContent ?? "")
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length > 0)
          .join("\n"),
      };
    },

    async commitDraft(input: CommitDraftInput): Promise<CommitDraftResult> {
      // Built with an explicit loop rather than `Object.entries().map()`: the draft's translation
      // map is a `Partial<Record<Locale, …>>`, and entries-then-fromEntries loses the key type.
      const translations: Record<string, TranslationPayload> = {};
      for (const locale of /* SAFETY: The producer contract guarantees this value satisfies Locale[]. */ Object.keys(
        input.translations
      ) as Locale[]) {
        const translation = input.translations[locale];
        if (!translation) continue;
        translations[locale] = {
          title: translation.title ?? "",
          excerpt: translation.excerpt ?? null,
          description: translation.description ?? null,
          summary: translation.summary ?? null,
          content:
            translation.content === undefined
              ? undefined
              : { content: translation.content },
        };
      }

      if (input.feedId === undefined) {
        const created = await createFeedService(
          db,
          {
            adminId,
            slug: input.feedMeta.slug,
            type: input.feedMeta.type ?? FeedTypeEnum.Post,
            contentType: input.feedMeta.contentType ?? ContentTypeEnum.Mdx,
            defaultLocale: input.feedMeta.defaultLocale,
            mainImage: input.feedMeta.mainImage ?? undefined,
            // Never published on commit — publishing is separately approved.
            published: false,
            translations,
          },
          feedHooks
        );
        if (!created) {
          throw new Error("Creating the feed returned no row.");
        }
        return { feedId: created.id, slug: created.slug, created: true };
      }

      const updated = await updateFeedService(
        db,
        {
          feedId: input.feedId,
          type: input.feedMeta.type,
          contentType: input.feedMeta.contentType,
          defaultLocale: input.feedMeta.defaultLocale,
          mainImage: input.feedMeta.mainImage ?? undefined,
          translations,
        },
        feedHooks
      );
      return { feedId: updated.id, slug: updated.slug, created: false };
    },

    async setPublished(input) {
      const updated = await updateFeedService(
        db,
        { feedId: input.feedId, published: input.published },
        feedHooks
      );
      return { feedId: updated.id, published: updated.published };
    },
  };
};

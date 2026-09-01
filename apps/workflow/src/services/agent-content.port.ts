import type {
  CommitDraftInput,
  CommitDraftResult,
  ContentPort,
} from "@chia/agent-writing/ports";
import { createContentReadPort } from "@chia/api/agents/content-read.port";
import { createFeedService, updateFeedService } from "@chia/api/feeds/write";
import type { DB } from "@chia/db/client";
import type { Locale } from "@chia/db/types";
import {
  ContentType as ContentTypeEnum,
  FeedType as FeedTypeEnum,
} from "@chia/db/types";

import { feedHooks } from "./feed-indexing.service";

/**
 * Author-visibility reads plus writing-agent writes, via `createFeedService`/`updateFeedService`
 * so slug normalization matches the dashboard. Indexing is passed in: a workflow step has no
 * request context. `adminId` is the configured author, never tool input.
 */

interface TranslationPayload {
  title: string;
  excerpt: string | null;
  description: string | null;
  summary: string | null;
  content?: { content: string };
}

export interface CreateContentPortOptions {
  db: DB;
  /** Configured author; the writing kind admits no one else. */
  adminId: string;
  /** After a successful `commitDraft`. The turn reads it once the turn has ended. */
  onCommitted?: () => void;
}

export const createAgentContentPort = (
  options: CreateContentPortOptions
): ContentPort => {
  const { db, adminId, onCommitted } = options;

  const read = createContentReadPort({
    db,
    authorId: adminId,
    visibility: "author",
  });

  return {
    ...read,

    async commitDraft(input: CommitDraftInput): Promise<CommitDraftResult> {
      // Explicit loop: the draft's translation map is a `Partial<Record<Locale, …>>`,
      // and entries-then-fromEntries loses the key type.
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
        const slug = input.feedMeta.slug;
        if (!slug) {
          throw new Error(
            "A new feed requires an explicit English/ASCII slug."
          );
        }
        const created = await createFeedService(
          db,
          {
            adminId,
            slug,
            type: input.feedMeta.type ?? FeedTypeEnum.Post,
            contentType: input.feedMeta.contentType ?? ContentTypeEnum.Mdx,
            defaultLocale: input.feedMeta.defaultLocale,
            mainImage: input.feedMeta.mainImage ?? undefined,
            // Never published on commit. Publishing is separately approved.
            published: false,
            translations,
          },
          feedHooks
        );
        if (!created) {
          throw new Error("Creating the feed returned no row.");
        }
        onCommitted?.();
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
      onCommitted?.();
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

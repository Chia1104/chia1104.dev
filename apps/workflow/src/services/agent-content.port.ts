import { createContentReadPort } from "@chia/agent-host/content-read.port";
import type {
  CommitDraftInput,
  CommitDraftResult,
  ContentPort,
} from "@chia/agent-writing/ports";
import { createFeedService, updateFeedService } from "@chia/api/feeds/write";
import type { DB } from "@chia/db/client";
import type { Locale } from "@chia/db/types";
import {
  ContentType as ContentTypeEnum,
  FeedType as FeedTypeEnum,
} from "@chia/db/types";

import { feedHooks } from "./feed-indexing.service";

/**
 * {@link ContentPort} implementation: the author-visibility read port plus the writes only the
 * writing agent performs.
 *
 * Writes go through `createFeedService`/`updateFeedService` rather than their own queries, so
 * the agent is subject to the same slug normalization as a human using the dashboard. Post-write
 * indexing is passed in explicitly: this runs in a workflow step with no request context to
 * carry it.
 *
 * Takes a `DB` rather than a `ServiceContext`, because it is constructed inside a
 * workflow step where no request exists. Authorisation happened at the transport boundary before
 * the run was started — the writing kind admits only the configured admin — so `adminId` is that
 * configured author, never tool input.
 */

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
  /**
   * Called after every successful `commitDraft`. The turn reads it once the turn has ended —
   * the transcript is only complete then — to decide whether to start a reflection run.
   */
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
            // Never published on commit — publishing is separately approved.
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

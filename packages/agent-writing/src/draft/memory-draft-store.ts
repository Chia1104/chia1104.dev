import type { PostSnapshot } from "@chia/agent-content/types";
import type { Locale } from "@chia/db/types";

import type { DraftStore } from "../ports.ts";
import type { DraftFeedMeta, DraftTranslation, FeedDraft } from "../types.ts";

import { emptyDraft, patchFeedMeta, patchTranslation } from "./operations.ts";

/** In-memory {@link DraftStore} for tests and the faux provider. */
export class InMemoryDraftStore implements DraftStore {
  private readonly drafts = new Map<string, FeedDraft>();

  private read(sessionId: string): FeedDraft {
    return this.drafts.get(sessionId) ?? emptyDraft();
  }

  private write(sessionId: string, draft: FeedDraft): FeedDraft {
    this.drafts.set(sessionId, draft);
    return draft;
  }

  get(sessionId: string): Promise<FeedDraft> {
    return Promise.resolve(this.read(sessionId));
  }

  patchFeedMeta(sessionId: string, patch: DraftFeedMeta): Promise<FeedDraft> {
    return Promise.resolve(
      this.write(sessionId, patchFeedMeta(this.read(sessionId), patch))
    );
  }

  patchTranslation(
    sessionId: string,
    locale: Locale,
    patch: DraftTranslation
  ): Promise<FeedDraft> {
    return Promise.resolve(
      this.write(
        sessionId,
        patchTranslation(this.read(sessionId), locale, patch)
      )
    );
  }

  setContent(
    sessionId: string,
    locale: Locale,
    content: string
  ): Promise<FeedDraft> {
    return this.patchTranslation(sessionId, locale, { content });
  }

  markCommitted(sessionId: string, feedId: number): Promise<FeedDraft> {
    return Promise.resolve(
      this.write(sessionId, {
        ...this.read(sessionId),
        committedFeedId: feedId,
      })
    );
  }

  seedFromPost(sessionId: string, post: PostSnapshot): Promise<FeedDraft> {
    let draft: FeedDraft = {
      feedMeta: {
        slug: post.slug,
        type: post.type,
        contentType: post.contentType,
        defaultLocale: post.defaultLocale,
        mainImage: post.mainImage,
        tagSlugs: post.tagSlugs,
      },
      translations: {},
      committedFeedId: post.feedId,
    };
    for (const { locale, ...translation } of post.translations) {
      draft = patchTranslation(draft, locale, {
        ...translation,
        content: translation.content ?? undefined,
      });
    }
    return Promise.resolve(this.write(sessionId, draft));
  }
}

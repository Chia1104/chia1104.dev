import { all } from "better-all";
import { start } from "workflow/api";

import type { DB } from "@chia/db";
import { getFeedForIndexing } from "@chia/db/repos/feeds";
import dayjs from "@chia/utils/day";

import {
  deleteFeedFromAlgoliaWorkflow,
  saveFeedToAlgoliaWorkflow,
} from "../workflows/algolia-search.workflow";
import { estimateReadingTimeWorkflow } from "../workflows/estimate-reading-time.workflow";
import { feedEmbeddingsWorkflow } from "../workflows/feed-embeddings.workflow";

export async function syncFeedSearchIndex(db: DB, feedID: number) {
  const feed = await getFeedForIndexing(db, { feedId: feedID });
  if (!feed) {
    return;
  }

  const enabled = feed.published && !feed.deletedAt;

  await Promise.all(
    feed.translations.map((translation) => {
      const content =
        translation.content?.content ?? translation.description ?? "";

      return all({
        async feedEmbeddings() {
          return await start(feedEmbeddingsWorkflow, [
            {
              feedID,
              locale: translation.locale,
              content,
              enabled,
            },
          ]);
        },
        async estimateReadingTime() {
          return await start(estimateReadingTimeWorkflow, [
            {
              feedID,
              locale: translation.locale,
              content,
            },
          ]);
        },
        async saveFeedToAlgolia() {
          return await start(saveFeedToAlgoliaWorkflow, [
            {
              feedID,
              objectID: translation.id,
              type: feed.type,
              locale: translation.locale,
              title: translation.title,
              content,
              description: translation.description ?? "",
              createdAt: dayjs(feed.createdAt).toISOString(),
              updatedAt: dayjs(feed.updatedAt).toISOString(),
              slug: feed.slug,
              enabled,
            },
          ]);
        },
      });
    })
  );
}

export async function removeFeedFromSearchIndex(
  translationIDs: readonly number[]
) {
  if (translationIDs.length === 0) {
    return;
  }

  await start(deleteFeedFromAlgoliaWorkflow, [
    {
      objectIDs: [...translationIDs],
    },
  ]);
}

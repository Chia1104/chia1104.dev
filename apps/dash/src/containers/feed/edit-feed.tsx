"use client";

import { notFound } from "next/navigation";

import { Spinner } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";

import type { Locale } from "@chia/db/types";
import { ErrorBoundary } from "@chia/ui/error-boundary";
import dayjs from "@chia/utils/day";

import { orpc } from "@/libs/orpc/client";
import type { RouterOutputs } from "@/libs/orpc/types";
import type { FormSchema } from "@/store/draft/slices/edit-fields";

import EditView from "./edit-view";

type Feed = NonNullable<RouterOutputs["feeds"]["details-by-id"]>;

const toDefaultValues = (feed: Feed) => ({
  type: feed.type,
  slug: feed.slug,
  updatedAt: dayjs(feed.updatedAt).valueOf(),
  createdAt: dayjs(feed.createdAt).valueOf(),
  contentType: feed.contentType,
  published: feed.published,
  defaultLocale: feed.defaultLocale,
  translations: feed.translations.reduce<
    Record<Locale, FormSchema["translations"][Locale]>
  >(
    (acc, translation) => {
      acc[translation.locale] = {
        title: translation.title,
        description: translation.description ?? null,
        excerpt: translation.excerpt ?? null,
        summary: translation.summary ?? null,
        readTime: translation.readTime ?? null,
        // the body is flat on the translation; the form still groups it
        content: {
          content: translation.content ?? null,
          source: translation.source ?? null,
          unstableSerializedSource:
            translation.unstableSerializedSource ?? null,
        },
      };
      return acc;
    },
    /* SAFETY: The producer contract guarantees this value satisfies Record<Locale, FormSchema["translations"][Locale]>. */ {} as Record<
      Locale,
      FormSchema["translations"][Locale]
    >
  ),
});

/** Reached for drafts and trash too, so it opts out of the published, non-deleted default. */
export const EditFeed = ({ feedId }: { feedId: number }) => {
  const { data: feed, isLoading } = useQuery(
    orpc.feeds["details-by-id"].queryOptions({
      input: { feedId, includeUnpublished: true, includeDeleted: true },
      // The form owns its state after mount; a background refetch would only churn
      // the props `useForm` has already read once.
      staleTime: Infinity,
      retry: false,
    })
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="md" />
      </div>
    );
  }
  if (!feed) {
    notFound();
  }

  return (
    <ErrorBoundary>
      <EditView
        feedId={feed.id}
        defaultValues={toDefaultValues(feed)}
        // the drawer indexes by translation id, so it needs the ids the
        // form itself has no use for
        resources={feed.translations.map((t) => ({
          locale: t.locale,
          sourceId: t.id,
        }))}
        meta={{
          embedding: Object.fromEntries(
            feed.translations.map((t) => [t.locale, t.hasEmbedding])
          ),
          published: feed.published,
          deleted: feed.deletedAt ? dayjs(feed.deletedAt).toISOString() : null,
        }}
      />
    </ErrorBoundary>
  );
};

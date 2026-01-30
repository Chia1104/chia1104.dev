import { notFound } from "next/navigation";
import { ViewTransition } from "react";

import { all } from "better-all";
import * as z from "zod";

import { FeedType } from "@chia/db/types";
import type { Locale } from "@chia/db/types";
import { ErrorBoundary } from "@chia/ui/error-boundary";
import dayjs from "@chia/utils/day";
import { NumericStringSchema } from "@chia/utils/schema";

import EditView from "@/containers/feed/edit-view";
import { client } from "@/libs/orpc/client";
import type { FormSchema } from "@/store/draft/slices/edit-fields";

export const dynamic = "force-dynamic";

const schema = z.object({
  id: NumericStringSchema,
  type: z.enum(FeedType).nullish(),
});

const Page = async ({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  try {
    const {
      params: { id },
      searchParams: { type },
    } = await all({
      params: () => params,
      searchParams: () => searchParams,
    });

    const validation = schema.safeParse({ id, type });
    if (!validation.success) {
      notFound();
    }

    const feed = await client.feeds["details-by-id"]({
      feedId: Number(id),
    });

    if (!feed) {
      notFound();
    }

    const defaultValues = {
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
            content: translation.content
              ? {
                  content: translation.content.content ?? null,
                  source: translation.content.source ?? null,
                  unstableSerializedSource:
                    translation.content.unstableSerializedSource ?? null,
                }
              : undefined,
          };
          return acc;
        },
        {} as Record<Locale, FormSchema["translations"][Locale]>
      ),
    };

    return (
      <ViewTransition>
        <ErrorBoundary>
          <section className="flex min-h-screen w-full justify-center">
            <div className="w-full max-w-4xl px-4 py-8 md:px-6 lg:px-8">
              <EditView feedId={feed.id} defaultValues={defaultValues} />
            </div>
          </section>
        </ErrorBoundary>
      </ViewTransition>
    );
  } catch {
    notFound();
  }
};

export default Page;

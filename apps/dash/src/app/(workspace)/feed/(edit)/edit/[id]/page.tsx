import { notFound } from "next/navigation";
import { z } from "zod";

import { FeedType } from "@chia/db/types";
import { ErrorBoundary } from "@chia/ui/error-boundary";
import { numericStringSchema } from "@chia/utils";
import dayjs from "@chia/utils/day";

import EditForm from "@/components/feed/edit-form";
import { api } from "@/trpc/rsc";

export const dynamic = "force-dynamic";

const schema = z.object({
  id: numericStringSchema,
  type: z.enum(FeedType).nullish(),
});

const Page = async ({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const { id } = await params;
  const { type } = await searchParams;
  if (
    !schema.safeParse({
      id,
      type,
    }).success
  ) {
    notFound();
  }
  const feed = await api.feeds.getFeedById({
    feedId: Number(id),
  });
  if (!feed) {
    notFound();
  }
  return (
    <ErrorBoundary>
      <EditForm
        feedId={feed.id}
        defaultValues={{
          id: feed.id,
          type: feed.type,
          title: feed.title,
          slug: feed.slug,
          description: feed.description,
          updatedAt: dayjs(feed.updatedAt).valueOf(),
          createdAt: dayjs(feed.createdAt).valueOf(),
          contentType: feed.contentType,
          published: feed.published,
          content: feed.content?.content,
          source: feed.content?.source,
        }}
      />
    </ErrorBoundary>
  );
};

export default Page;

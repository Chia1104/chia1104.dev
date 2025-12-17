import { notFound } from "next/navigation";
import * as z from "zod";

import { FeedType } from "@chia/db/types";
import { ErrorBoundary } from "@chia/ui/error-boundary";
import dayjs from "@chia/utils/day";
import { NumericStringSchema } from "@chia/utils/schema";

import EditForm from "@/components/feed/edit-form";
import { client } from "@/libs/orpc/client";

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
  const feed = await client.feeds["details-by-id"]({
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

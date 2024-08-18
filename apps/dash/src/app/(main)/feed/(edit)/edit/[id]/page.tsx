import dayjs from "dayjs";
import { notFound } from "next/navigation";
import { z } from "zod";

import { FeedType } from "@chia/db/types";
import { ErrorBoundary } from "@chia/ui";
import { numericStringSchema } from "@chia/utils";

import { api } from "@/trpc/rsc";

import EditForm from "./edit-form";

export const dynamic = "force-dynamic";

const schema = z.object({
  id: numericStringSchema,
  type: z.nativeEnum(FeedType),
});

const Page = async ({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: Record<string, string | string[] | undefined>;
}) => {
  if (
    !schema.safeParse({
      id: params.id,
      type: searchParams.type,
    }).success
  ) {
    notFound();
  }
  const feed = await api.feeds.getFeedById({
    feedId: Number(params.id),
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

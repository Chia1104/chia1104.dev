"use client";

import dynamic from "next/dynamic";
import { notFound } from "next/navigation";

import { Spinner } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/libs/orpc/client";

const DraftEditor = dynamic(
  () => import("@/components/feed/draft-editor").then((mod) => mod.DraftEditor),
  { ssr: false }
);

const Loading = () => (
  <div className="flex justify-center py-16">
    <Spinner size="md" />
  </div>
);

/** Opens a draft by its own id. */
export const EditDraft = ({ draftId }: { draftId: number }) => {
  const { data: draft, isLoading } = useQuery(
    orpc.feeds["draft:get"].queryOptions({
      input: { draftId },
      // The editor owns the draft after mount and polls on its own.
      staleTime: Infinity,
      retry: false,
    })
  );

  if (isLoading) return <Loading />;
  if (!draft) notFound();
  return <DraftEditor draft={draft} />;
};

/** Opens a post's working draft, creating it from the post when there is none. */
export const EditFeed = ({ feedId }: { feedId: number }) => {
  const { data: draft, isLoading } = useQuery(
    orpc.feeds["draft:open"].queryOptions({
      input: { feedId },
      staleTime: Infinity,
      retry: false,
    })
  );

  if (isLoading) return <Loading />;
  if (!draft) notFound();
  return <DraftEditor draft={draft} />;
};

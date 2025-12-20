"use client";

import { useTransition } from "react";

import { Button } from "@heroui/react";
import { useAction } from "next-safe-action/hooks";

import { generateFeedDraftSecret } from "@/server/feed.action";

interface Props {
  slug: string;
  type: "post" | "note";
}

export const DraftPreview = ({ slug, type }: Props) => {
  const { execute } = useAction(generateFeedDraftSecret);
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      onPress={() => startTransition(() => execute({ slug, type }))}
      isLoading={isPending}>
      Preview
    </Button>
  );
};

"use client";

import { useRouter } from "next/navigation";

import { AlertDialog, Button, Card, Chip, Tooltip } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash } from "lucide-react";
import { toast } from "sonner";

import CHCard from "@chia/ui/card";
import DateFormat from "@chia/ui/date-format";

import { orpc } from "@/libs/orpc/client";
import type { RouterOutputs } from "@/libs/orpc/types";

import { Logo } from "../commons/logo";

import FeedSkeleton from "./skeleton";

type Draft = RouterOutputs["feeds"]["draft:list"]["items"][number];

const SUPPORTED_LOCALES_META = [
  { key: "zh-TW", label: "中文" },
  { key: "en", label: "EN" },
] as const;

const Empty = () => (
  <CHCard
    className="prose dark:prose-invert flex w-full max-w-full flex-col items-center justify-center gap-5 px-1 py-12 sm:px-4"
    wrapperProps={{ className: "w-full" }}>
    <h3>No open drafts</h3>
    <div className="not-prose">
      <Logo classNames={{ root: "size-20" }} />
    </div>
  </CHCard>
);

const DraftItem = ({ draft }: { draft: Draft }) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const title =
    draft.translations[draft.defaultLocale]?.title ??
    Object.values(draft.translations).find((t) => t?.title)?.title ??
    "Untitled";
  const bound = draft.feedId !== null;

  const discard = useMutation(
    orpc.feeds["draft:discard"].mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: orpc.feeds["draft:list"].key(),
        }),
      onError: (error) =>
        toast.error(error instanceof Error ? error.message : "Discard failed"),
    })
  );

  return (
    <Card>
      <Card.Header>
        <Tooltip isDisabled={title.length <= 50} delay={400}>
          <Tooltip.Trigger>
            <Card.Title className="line-clamp-2 cursor-default text-xl">
              {title}
            </Card.Title>
          </Tooltip.Trigger>
          <Tooltip.Content showArrow>
            <Tooltip.Arrow />
            <p className="max-w-xs text-sm">{title}</p>
          </Tooltip.Content>
        </Tooltip>
      </Card.Header>
      <Card.Content className="gap-3">
        <div className="flex items-center gap-2">
          <Chip size="sm" variant="soft">
            <Chip.Label>{draft.type}</Chip.Label>
          </Chip>
          {bound ? (
            <Chip color="warning" size="sm" variant="soft">
              <Chip.Label>Feed #{draft.feedId} · unapplied changes</Chip.Label>
            </Chip>
          ) : (
            <Chip color="accent" size="sm" variant="soft">
              <Chip.Label>New post</Chip.Label>
            </Chip>
          )}
          <span className="text-muted font-mono text-xs">
            r{draft.revision}
          </span>
        </div>
        <div className="flex flex-col gap-1.5 rounded-lg border border-dashed p-2.5">
          {SUPPORTED_LOCALES_META.map(({ key, label }) => {
            const translation = draft.translations[key];
            const translationTitle = translation?.title ?? "";
            return (
              <div key={key} className="flex items-center gap-2">
                <Chip
                  variant="soft"
                  color={key === draft.defaultLocale ? "accent" : "default"}
                  size="sm"
                  className="w-9 shrink-0 justify-center font-mono text-[10px]">
                  {label}
                </Chip>
                {translationTitle ? (
                  <span className="line-clamp-1 min-w-0 flex-1 text-xs">
                    {translationTitle}
                  </span>
                ) : (
                  <span className="text-muted-foreground flex-1 text-xs italic">
                    — Not translated
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </Card.Content>
      <Card.Footer className="mt-auto flex items-center justify-between text-xs font-bold">
        <DateFormat date={draft.updatedAt} format="MMMM D, YYYY HH:mm" />
        <span className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onPress={() => router.push(`/feed/draft/${draft.id}`)}>
            <Pencil className="size-3.5" />
            <span className="text-xs">Edit</span>
          </Button>
          <AlertDialog>
            <Button variant="danger" size="sm" isDisabled={discard.isPending}>
              <Trash className="size-3.5" />
              <span className="text-xs">{bound ? "Discard" : "Delete"}</span>
            </Button>
            <AlertDialog.Backdrop>
              {(action) => (
                <AlertDialog.Container>
                  <AlertDialog.Dialog className="sm:max-w-[400px]">
                    <AlertDialog.CloseTrigger />
                    <AlertDialog.Header>
                      <AlertDialog.Icon status="warning" />
                      <AlertDialog.Heading>
                        {bound ? "Discard unapplied changes?" : "Delete draft?"}
                      </AlertDialog.Heading>
                    </AlertDialog.Header>
                    <AlertDialog.Body>
                      <p>
                        {bound
                          ? "The draft goes back to what the post holds now."
                          : "The draft and its revisions are deleted."}
                      </p>
                    </AlertDialog.Body>
                    <AlertDialog.Footer>
                      <Button slot="close" variant="tertiary">
                        Cancel
                      </Button>
                      <Button
                        variant="danger"
                        onPress={() => {
                          discard.mutate({ draftId: draft.id });
                          action.state.close();
                        }}>
                        {bound ? "Discard" : "Delete"}
                      </Button>
                    </AlertDialog.Footer>
                  </AlertDialog.Dialog>
                </AlertDialog.Container>
              )}
            </AlertDialog.Backdrop>
          </AlertDialog>
        </span>
      </Card.Footer>
    </Card>
  );
};

export const DraftList = () => {
  const drafts = useQuery(orpc.feeds["draft:list"].queryOptions());

  if (drafts.isLoading) {
    return (
      <div className="grid w-full grid-cols-1 gap-5 md:grid-cols-2">
        <FeedSkeleton />
      </div>
    );
  }
  const items = drafts.data?.items ?? [];
  if (items.length === 0) return <Empty />;

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {items.map((draft) => (
          <DraftItem key={draft.id} draft={draft} />
        ))}
      </div>
    </div>
  );
};

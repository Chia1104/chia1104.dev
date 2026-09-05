"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";

import {
  AlertDialog,
  Button,
  Calendar,
  Card,
  Chip,
  DateField,
  DatePicker,
  Disclosure,
  Label,
  Switch,
  Tooltip,
} from "@heroui/react";
import { getLocalTimeZone, parseAbsolute } from "@internationalized/date";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, RotateCcw, Trash, Upload } from "lucide-react";
import { toast } from "sonner";

import dayjs from "@chia/utils/day";

import { EmbeddingDrawer } from "@/components/rag/embedding-drawer";
import { client, orpc } from "@/libs/orpc/client";

import { DeleteButton } from "./delete-button";
import type { DraftView } from "./draft-values";
import { MetaChip } from "./meta-chip";
import { RevisionsDrawer } from "./revisions-drawer";

const errorMessage = (cause: unknown) =>
  cause instanceof Error ? cause.message : "Something went wrong.";

const feedDetailsOptions = (feedId: number) =>
  orpc.feeds["details-by-id"].queryOptions({
    input: { feedId, includeUnpublished: true, includeDeleted: true },
  });

/** Embedding and visibility state of the post behind a bound draft. */
const FeedStatus = ({ feedId }: { feedId: number }) => {
  const { data: feed } = useQuery(feedDetailsOptions(feedId));
  if (!feed) return null;
  return (
    <MetaChip
      deleted={feed.deletedAt}
      embedding={Object.fromEntries(
        feed.translations.map((translation) => [
          translation.locale,
          translation.hasEmbedding,
        ])
      )}
      published={feed.published}
    />
  );
};

/** The RAG drawer indexes by translation id, which the draft does not carry. */
const FeedEmbedding = ({ feedId }: { feedId: number }) => {
  const { data: feed } = useQuery(feedDetailsOptions(feedId));
  if (!feed) return null;
  return (
    <EmbeddingDrawer
      feedId={feedId}
      resources={feed.translations.map((translation) => ({
        locale: translation.locale,
        sourceId: translation.id,
      }))}
    />
  );
};

/**
 * Feed-level switches that are not part of the draft: visibility and the publication date
 * write straight to the feed, so they only exist once the draft has been applied.
 */
const PostSettings = ({ feedId }: { feedId: number }) => {
  const queryClient = useQueryClient();
  const feedQuery = useQuery(feedDetailsOptions(feedId));
  const update = useMutation(
    orpc.feeds.update.mutationOptions({
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: orpc.feeds["details-by-id"].key({ input: { feedId } }),
          }),
          queryClient.invalidateQueries({ queryKey: orpc.feeds.list.key() }),
        ]);
      },
      onError: (error) => toast.error(errorMessage(error)),
    })
  );
  const feed = feedQuery.data;
  if (!feed) return null;

  return (
    <div className="flex flex-wrap gap-4">
      <Switch
        className="flex-row"
        isDisabled={update.isPending}
        isSelected={feed.published}
        onChange={(published) => update.mutate({ feedId, published })}>
        <Switch.Content className="flex flex-col items-start justify-self-start">
          <Label className="text-sm">Published</Label>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch.Content>
      </Switch>
      <DatePicker
        hideTimeZone
        className="w-56"
        isDisabled={update.isPending}
        onChange={(value) => {
          if (!value) return;
          update.mutate({
            feedId,
            createdAt: dayjs(value.toString()).valueOf(),
          });
        }}
        value={parseAbsolute(
          dayjs(feed.createdAt).toISOString(),
          getLocalTimeZone()
        )}>
        <Label>Published date</Label>
        <DateField.Group fullWidth>
          <DateField.Input>
            {(segment) => <DateField.Segment segment={segment} />}
          </DateField.Input>
          <DateField.Suffix>
            <DatePicker.Trigger>
              <DatePicker.TriggerIndicator />
            </DatePicker.Trigger>
          </DateField.Suffix>
        </DateField.Group>
        <DatePicker.Popover>
          <Calendar aria-label="Published date">
            <Calendar.Header>
              <Calendar.YearPickerTrigger>
                <Calendar.YearPickerTriggerHeading />
                <Calendar.YearPickerTriggerIndicator />
              </Calendar.YearPickerTrigger>
              <Calendar.NavButton slot="previous" />
              <Calendar.NavButton slot="next" />
            </Calendar.Header>
            <Calendar.Grid>
              <Calendar.GridHeader>
                {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
              </Calendar.GridHeader>
              <Calendar.GridBody>
                {(date) => <Calendar.Cell date={date} />}
              </Calendar.GridBody>
            </Calendar.Grid>
            <Calendar.YearPickerGrid>
              <Calendar.YearPickerGridBody>
                {({ year }) => (
                  <Calendar.YearPickerCell className="text-xs" year={year} />
                )}
              </Calendar.YearPickerGridBody>
            </Calendar.YearPickerGrid>
          </Calendar>
        </DatePicker.Popover>
      </DatePicker>
      <div className="justify-self-center sm:ml-auto">
        <DeleteButton
          feedId={feedId}
          type={feed.type}
          deleted={!!feed.deletedAt}
        />
      </div>
    </div>
  );
};

const IconTooltip = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <Tooltip>
    {children}
    <Tooltip.Content>
      <p>{label}</p>
    </Tooltip.Content>
  </Tooltip>
);

const DiscardDialog = ({
  bound,
  isPending,
  isDisabled,
  onConfirm,
}: {
  bound: boolean;
  isPending: boolean;
  isDisabled: boolean;
  onConfirm: () => Promise<void>;
}) => {
  const label = bound ? "Discard changes" : "Delete draft";
  return (
    <IconTooltip label={label}>
      <AlertDialog>
        <Button
          aria-label={label}
          isDisabled={isDisabled}
          isIconOnly
          size="sm"
          variant="danger-soft">
          {bound ? (
            <RotateCcw className="size-4" />
          ) : (
            <Trash className="size-4" />
          )}
        </Button>
        <AlertDialog.Backdrop>
          {(action) => (
            <AlertDialog.Container>
              <AlertDialog.Dialog className="sm:max-w-[400px]">
                <AlertDialog.CloseTrigger />
                <AlertDialog.Header>
                  <AlertDialog.Icon status="warning" />
                  <AlertDialog.Heading>
                    {bound
                      ? "Discard unapplied changes?"
                      : "Delete this draft?"}
                  </AlertDialog.Heading>
                </AlertDialog.Header>
                <AlertDialog.Body>
                  <p>
                    {bound
                      ? "The draft goes back to what the post holds now. Revisions stay available for restore."
                      : "The draft and its revisions are deleted. A writing session on it starts a fresh draft next turn."}
                  </p>
                </AlertDialog.Body>
                <AlertDialog.Footer>
                  <Button slot="close" variant="tertiary">
                    Cancel
                  </Button>
                  <Button
                    isPending={isPending}
                    onPress={async () => {
                      try {
                        await onConfirm();
                        action.state.close();
                      } catch {
                        // The mutation reports errors and leaves confirmation open for retry.
                      }
                    }}
                    variant="danger">
                    {bound ? "Discard" : "Delete"}
                  </Button>
                </AlertDialog.Footer>
              </AlertDialog.Dialog>
            </AlertDialog.Container>
          )}
        </AlertDialog.Backdrop>
      </AlertDialog>
    </IconTooltip>
  );
};

export const DraftActions = ({
  draft,
  onDraftChanged,
  status,
  children,
  beforeAction,
  hasLocalChanges,
  isSaveBlocked,
}: {
  draft: DraftView;
  /** The server returned a whole draft; the form must adopt it. */
  onDraftChanged: (draft: DraftView) => void;
  status: ReactNode;
  children: ReactNode;
  beforeAction: () => Promise<boolean>;
  hasLocalChanges: boolean;
  isSaveBlocked: boolean;
}) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [revisionsOpen, setRevisionsOpen] = useState(false);
  const bound = draft.feedId !== null;
  const unapplied =
    draft.appliedRevision === null || draft.appliedRevision < draft.revision;

  const invalidateDraftLists = () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: orpc.feeds["draft:list"].key(),
      }),
      queryClient.invalidateQueries({ queryKey: orpc.feeds.list.key() }),
    ]);

  const prepare = async () => {
    if (!(await beforeAction()))
      throw new Error(
        "Save the draft and resolve any conflicts before continuing."
      );
  };

  const apply = useMutation({
    ...orpc.feeds["draft:apply"].mutationOptions({
      onSuccess: async (result) => {
        toast.success(
          result.created
            ? `Created post ${result.slug}`
            : `Updated post ${result.slug}`
        );
        const next = await queryClient.query(
          orpc.feeds["draft:get"].queryOptions({
            input: { draftId: draft.id },
          })
        );
        onDraftChanged(next);
        await invalidateDraftLists();
      },
      onError: (error) => toast.error(errorMessage(error)),
    }),
    mutationFn: async () => {
      await prepare();
      return client.feeds["draft:apply"]({ draftId: draft.id });
    },
  });

  const discard = useMutation({
    ...orpc.feeds["draft:discard"].mutationOptions({
      onSuccess: async () => {
        await invalidateDraftLists();
        if (!bound) {
          router.push("/feed/drafts");
          return;
        }
        const next = await queryClient.query(
          orpc.feeds["draft:get"].queryOptions({
            input: { draftId: draft.id },
          })
        );
        onDraftChanged(next);
      },
      onError: (error) => toast.error(errorMessage(error)),
    }),
    mutationFn: async () => {
      await prepare();
      return client.feeds["draft:discard"]({ draftId: draft.id });
    },
  });

  const restore = useMutation({
    mutationFn: async (revisionId: number) => {
      await prepare();
      return client.feeds["draft:restore"]({ draftId: draft.id, revisionId });
    },
    onSuccess: async (next) => {
      onDraftChanged(next);
      setRevisionsOpen(false);
      await Promise.all([
        invalidateDraftLists(),
        queryClient.invalidateQueries({
          queryKey: orpc.feeds["draft:revisions"].key({
            input: { draftId: draft.id },
          }),
        }),
      ]);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const isBusy = apply.isPending || discard.isPending || restore.isPending;
  const isDisabled = isBusy || isSaveBlocked;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <Card className="bg-background/95 sticky top-0 z-20 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
        <Card.Header className="min-w-0 gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Card.Title className="text-base font-semibold">
              {bound ? "Edit post" : "New post"}
            </Card.Title>
            <Chip size="sm" variant="soft">
              <Chip.Label>
                {unapplied || hasLocalChanges ? "Draft changes" : "Up to date"}
              </Chip.Label>
            </Chip>
            {draft.feedId !== null ? (
              <FeedStatus feedId={draft.feedId} />
            ) : null}
          </div>
          {status}
        </Card.Header>
        <Card.Footer className="shrink-0">
          <div
            className="flex items-center gap-1"
            role="toolbar"
            aria-label="Draft actions">
            {draft.feedId !== null ? (
              <FeedEmbedding feedId={draft.feedId} />
            ) : null}
            <IconTooltip label="Version history">
              <Button
                aria-label="Version history"
                isDisabled={isBusy}
                isIconOnly
                onPress={() => setRevisionsOpen(true)}
                size="sm"
                variant="tertiary">
                <History className="size-4" />
              </Button>
            </IconTooltip>
            <DiscardDialog
              bound={bound}
              isPending={discard.isPending}
              isDisabled={isDisabled}
              onConfirm={async () => {
                await discard.mutateAsync({ draftId: draft.id });
              }}
            />
            <IconTooltip label={bound ? "Apply to post" : "Create post"}>
              <Button
                aria-label={bound ? "Apply to post" : "Create post"}
                isDisabled={isDisabled || (!unapplied && !hasLocalChanges)}
                isIconOnly
                isPending={apply.isPending}
                onPress={() => apply.mutate({ draftId: draft.id })}
                size="sm"
                variant="primary">
                <Upload className="size-4" />
              </Button>
            </IconTooltip>
          </div>
        </Card.Footer>
      </Card>
      <div inert={isBusy} aria-busy={isBusy} className="min-w-0">
        {children}
      </div>
      {draft.feedId !== null ? (
        <Disclosure className="border-border rounded-xl border">
          <Disclosure.Heading>
            <Disclosure.Trigger className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium">
              Post settings
              <Disclosure.Indicator />
            </Disclosure.Trigger>
          </Disclosure.Heading>
          <Disclosure.Content>
            <Disclosure.Body className="flex flex-col gap-3 px-2">
              <p className="text-muted text-xs">
                Visibility and date changes take effect immediately.
              </p>
              <div inert={isBusy}>
                <PostSettings feedId={draft.feedId} />
              </div>
            </Disclosure.Body>
          </Disclosure.Content>
        </Disclosure>
      ) : null}
      <RevisionsDrawer
        draftId={draft.id}
        isOpen={revisionsOpen}
        onOpenChange={setRevisionsOpen}
        isRestoring={restore.isPending}
        isDisabled={isDisabled}
        onRestore={(revisionId) => restore.mutate(revisionId)}
      />
    </div>
  );
};

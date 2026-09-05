"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";

import {
  AlertDialog,
  Button,
  Calendar,
  Chip,
  DateField,
  DatePicker,
  Label,
  Switch,
} from "@heroui/react";
import { getLocalTimeZone, parseAbsolute } from "@internationalized/date";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, History, Upload } from "lucide-react";
import { useQueryState } from "nuqs";
import { toast } from "sonner";

import dayjs from "@chia/utils/day";

import { orpc } from "@/libs/orpc/client";

import type { DraftView } from "./draft-editor";
import { RevisionsDrawer } from "./revisions-drawer";

const errorMessage = (cause: unknown) =>
  cause instanceof Error ? cause.message : "Something went wrong.";

/**
 * Feed-level switches that are not part of the draft: visibility and the publication date
 * write straight to the feed, so they only exist once the draft has been applied.
 */
const PostSettings = ({ feedId }: { feedId: number }) => {
  const queryClient = useQueryClient();
  const feedQuery = useQuery(
    orpc.feeds["details-by-id"].queryOptions({
      input: { feedId, includeUnpublished: true, includeDeleted: true },
    })
  );
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
    <div className="flex flex-wrap items-end gap-4">
      <Switch
        className="flex-row"
        isDisabled={update.isPending}
        isSelected={feed.published}
        onChange={(published) => update.mutate({ feedId, published })}>
        <Switch.Content>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          <Label className="text-sm">Published</Label>
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
    </div>
  );
};

const DiscardDialog = ({
  bound,
  isPending,
  onConfirm,
}: {
  bound: boolean;
  isPending: boolean;
  onConfirm: () => void;
}) => (
  <AlertDialog>
    <Button isDisabled={isPending} variant="danger-soft">
      Discard
    </Button>
    <AlertDialog.Backdrop>
      {(action) => (
        <AlertDialog.Container>
          <AlertDialog.Dialog className="sm:max-w-[400px]">
            <AlertDialog.CloseTrigger />
            <AlertDialog.Header>
              <AlertDialog.Icon status="warning" />
              <AlertDialog.Heading>
                {bound ? "Discard unapplied changes?" : "Delete this draft?"}
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
                onPress={() => {
                  onConfirm();
                  action.state.close();
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
);

export const DraftActions = ({
  draft,
  onDraftChanged,
  status,
}: {
  draft: DraftView;
  /** The server returned a whole draft; the form must adopt it. */
  onDraftChanged: (draft: DraftView) => void;
  status: ReactNode;
}) => {
  const router = useRouter();
  const [, setAgent] = useQueryState("agent");
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

  const apply = useMutation(
    orpc.feeds["draft:apply"].mutationOptions({
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
    })
  );

  const discard = useMutation(
    orpc.feeds["draft:discard"].mutationOptions({
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
    })
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {bound ? (
            <Chip size="sm" variant="soft">
              <Chip.Label>Feed #{draft.feedId}</Chip.Label>
            </Chip>
          ) : (
            <Chip color="accent" size="sm" variant="soft">
              <Chip.Label>New post</Chip.Label>
            </Chip>
          )}
          {unapplied ? (
            <Chip color="warning" size="sm" variant="soft">
              <Chip.Label>Not applied</Chip.Label>
            </Chip>
          ) : null}
          {status}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onPress={() => void setAgent("open")}
            size="sm"
            variant="secondary">
            <Bot className="size-4" />
            Open in agent
          </Button>
          <Button
            onPress={() => setRevisionsOpen(true)}
            size="sm"
            variant="secondary">
            <History className="size-4" />
            Revisions
          </Button>
          <DiscardDialog
            bound={bound}
            isPending={discard.isPending}
            onConfirm={() => discard.mutate({ draftId: draft.id })}
          />
          <Button
            isDisabled={!unapplied}
            isPending={apply.isPending}
            onPress={() => apply.mutate({ draftId: draft.id })}
            size="sm"
            variant="primary">
            <Upload className="size-4" />
            {bound ? "Apply to post" : "Create post"}
          </Button>
        </div>
      </div>
      {draft.feedId !== null ? <PostSettings feedId={draft.feedId} /> : null}
      <RevisionsDrawer
        draftId={draft.id}
        isOpen={revisionsOpen}
        onOpenChange={setRevisionsOpen}
        onRestored={onDraftChanged}
      />
    </div>
  );
};

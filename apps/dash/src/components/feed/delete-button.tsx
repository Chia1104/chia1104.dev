"use client";

import { useRouter } from "next/navigation";
import { memo } from "react";

import { AlertDialog, Button, ButtonGroup, Dropdown } from "@heroui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";

import type { FeedType } from "@chia/db/types";

import { orpc } from "@/libs/orpc/client";

interface FeedActionProps {
  isPending: boolean;
  onConfirm: () => void;
}

const MoveToTrashDialog = memo(({ isPending, onConfirm }: FeedActionProps) => (
  <AlertDialog>
    <Button variant="danger-soft" isDisabled={isPending}>
      Move to Trash
    </Button>
    <AlertDialog.Backdrop>
      <AlertDialog.Container>
        <AlertDialog.Dialog className="sm:max-w-[400px]">
          <AlertDialog.CloseTrigger />
          <AlertDialog.Header>
            <AlertDialog.Icon status="warning" />
            <AlertDialog.Heading>Move feed to trash?</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body>
            <p>
              The feed will be hidden from the public site but can be restored
              later.
            </p>
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button slot="close" variant="tertiary" isDisabled={isPending}>
              Cancel
            </Button>
            <Button
              onPress={onConfirm}
              isDisabled={isPending}
              isPending={isPending}
              variant="danger-soft">
              Move to Trash
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  </AlertDialog>
));

const HardDeleteDialog = memo(({ isPending, onConfirm }: FeedActionProps) => (
  <AlertDialog>
    <Button
      fullWidth
      variant="danger-soft"
      className="flex h-fit flex-col items-start gap-1 p-2">
      Delete permanently
    </Button>
    <AlertDialog.Backdrop>
      <AlertDialog.Container>
        <AlertDialog.Dialog className="sm:max-w-[400px]">
          <AlertDialog.CloseTrigger />
          <AlertDialog.Header>
            <AlertDialog.Icon status="danger" />
            <AlertDialog.Heading>Delete feed permanently?</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body>
            <p>
              This will permanently delete this feed and all of its data. This
              action cannot be undone.
            </p>
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button slot="close" variant="tertiary" isDisabled={isPending}>
              Cancel
            </Button>
            <Button
              onPress={onConfirm}
              isDisabled={isPending}
              isPending={isPending}
              variant="danger">
              Delete Permanently
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  </AlertDialog>
));

const RestoreDialog = memo(({ isPending, onConfirm }: FeedActionProps) => {
  return (
    <AlertDialog>
      <Button
        variant="tertiary"
        className="flex h-fit flex-col items-start gap-1 p-2">
        Restore feed
      </Button>
      <AlertDialog.Backdrop>
        {(action) => (
          <AlertDialog.Container>
            <AlertDialog.Dialog className="sm:max-w-[400px]">
              <AlertDialog.CloseTrigger />
              <AlertDialog.Header>
                <AlertDialog.Icon status="success" />
                <AlertDialog.Heading>Restore feed?</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                <p>
                  This will restore the feed. It will become visible on the
                  public site if it was published before.
                </p>
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button slot="close" variant="tertiary" isDisabled={isPending}>
                  Cancel
                </Button>
                <Button
                  onPress={() => {
                    onConfirm();
                    action.state.close();
                  }}
                  isDisabled={isPending}
                  isPending={isPending}
                  variant="secondary">
                  Restore Feed
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        )}
      </AlertDialog.Backdrop>
    </AlertDialog>
  );
});

export const DeleteButton = memo(
  ({
    feedId,
    type,
    deleted,
  }: {
    feedId: number;
    type: FeedType;
    deleted: boolean;
  }) => {
    const router = useRouter();
    const queryClient = useQueryClient();

    const invalidateAndRedirect = async (redirect = true) => {
      await queryClient.invalidateQueries(
        orpc.feeds.list.queryOptions({
          input: { type },
        })
      );
      if (redirect) {
        router.push(`/feed/${type}s`);
      }
    };

    const deleteMutation = useMutation(
      orpc.feeds.delete.mutationOptions({
        onSuccess: async (data, { hard }) => {
          toast.success(
            hard ? "Feed permanently deleted" : "Feed moved to trash"
          );
          await invalidateAndRedirect();
        },
        onError: (err) => {
          toast.error(err.message);
        },
      })
    );

    const restoreMutation = useMutation(
      orpc.feeds.restore.mutationOptions({
        onSuccess: async () => {
          toast.success("Feed restored successfully");
          invalidateAndRedirect(false);
          router.refresh();
        },
        onError: (err) => {
          toast.error(err.message);
        },
      })
    );

    const isAnyPending = deleteMutation.isPending || restoreMutation.isPending;

    return (
      <ButtonGroup>
        {deleted ? (
          <RestoreDialog
            isPending={isAnyPending}
            onConfirm={() => restoreMutation.mutate({ feedId })}
          />
        ) : (
          <MoveToTrashDialog
            isPending={isAnyPending}
            onConfirm={() => deleteMutation.mutate({ feedId, hard: false })}
          />
        )}
        <Dropdown>
          <Button isIconOnly aria-label="more options" variant="danger-soft">
            <ButtonGroup.Separator />
            <ChevronDown />
          </Button>
          <Dropdown.Popover
            className="flex max-w-[200px] flex-col gap-2 p-2"
            placement="bottom end">
            <HardDeleteDialog
              isPending={isAnyPending}
              onConfirm={() => deleteMutation.mutate({ feedId, hard: true })}
            />
          </Dropdown.Popover>
        </Dropdown>
      </ButtonGroup>
    );
  }
);

"use client";

import { Button, Chip, Drawer, Spinner } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import dayjs from "@chia/utils/day";

import { DrawerPanel } from "@/components/commons/drawer-panel";
import { orpc } from "@/libs/orpc/client";
import type { RouterOutputs } from "@/libs/orpc/types";

type Revision = RouterOutputs["feeds"]["draft:revisions"]["items"][number];

const changeSummary = (revision: Revision) =>
  revision.changes
    .map((change) =>
      change.locale
        ? `${change.locale}: ${change.fields.join(", ")}`
        : change.fields.join(", ")
    )
    .join(" · ");

export const RevisionsDrawer = ({
  draftId,
  isOpen,
  onOpenChange,
  onRestored,
}: {
  draftId: number;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onRestored: (draft: RouterOutputs["feeds"]["draft:restore"]) => void;
}) => {
  const queryClient = useQueryClient();
  const revisions = useQuery(
    orpc.feeds["draft:revisions"].queryOptions({
      input: { draftId },
      enabled: isOpen,
    })
  );
  const restore = useMutation(
    orpc.feeds["draft:restore"].mutationOptions({
      onSuccess: async (draft) => {
        onRestored(draft);
        onOpenChange(false);
        await queryClient.invalidateQueries({
          queryKey: orpc.feeds["draft:revisions"].key({ input: { draftId } }),
        });
      },
      onError: (error) =>
        toast.error(error instanceof Error ? error.message : "Restore failed"),
    })
  );

  return (
    <Drawer.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <DrawerPanel>
        <Drawer.CloseTrigger />
        <Drawer.Header>
          <Drawer.Heading>Revisions</Drawer.Heading>
        </Drawer.Header>
        <Drawer.Body>
          {revisions.isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner size="sm" />
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {(revisions.data?.items ?? []).map((revision, index) => (
                <li
                  key={revision.id}
                  className="border-border flex items-center justify-between gap-3 rounded-xl border p-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs">
                        r{revision.revision}
                      </span>
                      <Chip
                        color={
                          revision.author === "agent" ? "accent" : "default"
                        }
                        size="sm"
                        variant="soft">
                        <Chip.Label>{revision.author}</Chip.Label>
                      </Chip>
                      <span className="text-muted text-xs">
                        {dayjs(revision.updatedAt).format("MMM D, HH:mm")}
                      </span>
                    </div>
                    <p className="text-muted truncate text-xs">
                      {changeSummary(revision) || "no field changes"}
                    </p>
                  </div>
                  <Button
                    isDisabled={index === 0 || restore.isPending}
                    onPress={() =>
                      restore.mutate({ draftId, revisionId: revision.id })
                    }
                    size="sm"
                    variant="secondary">
                    Restore
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Drawer.Body>
      </DrawerPanel>
    </Drawer.Backdrop>
  );
};

"use client";

import { Button, Card, Chip, Drawer, Spinner } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";

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
  onRestore,
  isRestoring,
  isDisabled,
}: {
  draftId: number;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onRestore: (revisionId: number) => void;
  isRestoring: boolean;
  isDisabled: boolean;
}) => {
  const revisions = useQuery(
    orpc.feeds["draft:revisions"].queryOptions({
      input: { draftId },
      enabled: isOpen,
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
                <li key={revision.id}>
                  <Card className="flex-row items-center justify-between gap-3 p-3">
                    <Card.Header className="min-w-0 gap-1">
                      <div className="flex items-center gap-2">
                        <Card.Title className="font-mono text-xs">
                          r{revision.revision}
                        </Card.Title>
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
                      <Card.Description className="truncate text-xs">
                        {changeSummary(revision) || "no field changes"}
                      </Card.Description>
                    </Card.Header>
                    <Card.Footer className="shrink-0">
                      <Button
                        isDisabled={index === 0 || isDisabled}
                        isPending={isRestoring}
                        onPress={() => onRestore(revision.id)}
                        size="sm"
                        variant="secondary">
                        Restore
                      </Button>
                    </Card.Footer>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </Drawer.Body>
      </DrawerPanel>
    </Drawer.Backdrop>
  );
};

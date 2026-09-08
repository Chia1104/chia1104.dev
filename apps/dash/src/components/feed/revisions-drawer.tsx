"use client";

import { useState } from "react";

import { Button, Card, Chip, Drawer, Spinner } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";

import dayjs from "@chia/utils/day";

import { DrawerPanel } from "@/components/commons/drawer-panel";
import { orpc } from "@/libs/orpc/client";
import type { RouterOutputs } from "@/libs/orpc/types";

type Revision = RouterOutputs["feeds"]["draft:revisions"]["items"][number];

/** One card plus the 8px gap rendered as its bottom padding. */
const ESTIMATED_ROW_SIZE = 80;

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
  // The drawer body only exists while the drawer is open, so the virtualizer
  // has to re-read it from state rather than a ref.
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(
    null
  );

  const items = revisions.data?.items ?? [];
  const virtualizer = useVirtualizer({
    count: items.length,
    estimateSize: () => ESTIMATED_ROW_SIZE,
    getItemKey: (index) => items[index]?.id ?? index,
    getScrollElement: () => scrollElement,
    overscan: 6,
  });

  return (
    <Drawer.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <DrawerPanel>
        <Drawer.CloseTrigger />
        <Drawer.Header>
          <Drawer.Heading>Revisions</Drawer.Heading>
        </Drawer.Header>
        <Drawer.Body ref={setScrollElement}>
          {revisions.isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner size="sm" />
            </div>
          ) : (
            <ul
              className="relative w-full"
              style={{ height: virtualizer.getTotalSize() }}>
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const revision = items[virtualRow.index];
                if (!revision) return null;
                return (
                  <li
                    key={virtualRow.key}
                    ref={virtualizer.measureElement}
                    className="absolute top-0 left-0 w-full pb-2"
                    data-index={virtualRow.index}
                    style={{ transform: `translateY(${virtualRow.start}px)` }}>
                    <Card
                      className="flex-row items-center justify-between gap-3 p-3"
                      variant="secondary">
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
                          isDisabled={virtualRow.index === 0 || isDisabled}
                          isPending={isRestoring}
                          onPress={() => onRestore(revision.id)}
                          size="sm"
                          variant="secondary">
                          Restore
                        </Button>
                      </Card.Footer>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </Drawer.Body>
      </DrawerPanel>
    </Drawer.Backdrop>
  );
};

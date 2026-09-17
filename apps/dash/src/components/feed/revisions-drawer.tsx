"use client";

import { useState } from "react";

import { Button, Card, Chip, Drawer, Spinner, Tabs } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Pin, PinOff } from "lucide-react";
import { toast } from "sonner";

import dayjs from "@chia/utils/day";

import { DrawerPanel } from "@/components/commons/drawer-panel";
import { orpc } from "@/libs/orpc/client";
import type { RouterOutputs } from "@/libs/orpc/types";

type Revision = RouterOutputs["feeds"]["draft:revisions"]["items"][number];

/** One card plus the 8px gap rendered as its bottom padding. */
const ESTIMATED_ROW_SIZE = 80;

/** Versions applied to the post, and the restore points the write path keeps between them. */
const KINDS = [
  { kind: "commit", label: "History", empty: "Nothing applied yet." },
  { kind: "safety", label: "Restore points", empty: "No restore points yet." },
] as const;

const changeSummary = (revision: Revision) =>
  revision.changes
    .map((change) =>
      change.locale
        ? `${change.locale}: ${change.fields.join(", ")}`
        : change.fields.join(", ")
    )
    .join(" · ");

const RevisionList = ({
  draftId,
  kind,
  empty,
  currentHash,
  scrollElement,
  onRestore,
  isRestoring,
  isDisabled,
}: {
  draftId: number;
  kind: Revision["kind"];
  empty: string;
  currentHash: string;
  scrollElement: HTMLDivElement | null;
  onRestore: (revisionId: number) => void;
  isRestoring: boolean;
  isDisabled: boolean;
}) => {
  const queryClient = useQueryClient();
  const revisions = useQuery(
    orpc.feeds["draft:revisions"].queryOptions({ input: { draftId, kind } })
  );
  const pin = useMutation(
    orpc.feeds["draft:pin"].mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: orpc.feeds["draft:revisions"].key({
            input: { draftId, kind },
          }),
        }),
      onError: (error) => toast.error(error.message),
    })
  );

  const items = revisions.data?.items ?? [];
  const virtualizer = useVirtualizer({
    count: items.length,
    estimateSize: () => ESTIMATED_ROW_SIZE,
    getItemKey: (index) => items[index]?.id ?? index,
    getScrollElement: () => scrollElement,
    overscan: 6,
  });

  if (revisions.isLoading)
    return (
      <div className="flex justify-center py-8">
        <Spinner size="sm" />
      </div>
    );
  if (items.length === 0)
    return <p className="text-muted py-8 text-center text-sm">{empty}</p>;

  return (
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
                    {revision.contentHash.slice(0, 7)}
                  </Card.Title>
                  <Chip
                    color={revision.author === "agent" ? "accent" : "default"}
                    size="sm"
                    variant="soft">
                    <Chip.Label>{revision.author}</Chip.Label>
                  </Chip>
                  <span className="text-muted text-xs">
                    {dayjs(revision.createdAt).format("MMM D, HH:mm")}
                  </span>
                </div>
                <Card.Description className="truncate text-xs">
                  {revision.message ||
                    changeSummary(revision) ||
                    "no field changes"}
                </Card.Description>
              </Card.Header>
              <Card.Footer className="shrink-0 gap-1">
                {revision.kind === "safety" ? (
                  <Button
                    aria-label={
                      revision.pinned
                        ? "Let this restore point expire"
                        : "Keep this restore point"
                    }
                    isDisabled={pin.isPending}
                    isIconOnly
                    onPress={() =>
                      pin.mutate({
                        draftId,
                        revisionId: revision.id,
                        pinned: !revision.pinned,
                      })
                    }
                    size="sm"
                    variant={revision.pinned ? "secondary" : "tertiary"}>
                    {revision.pinned ? (
                      <PinOff className="size-3.5" />
                    ) : (
                      <Pin className="size-3.5" />
                    )}
                  </Button>
                ) : null}
                <Button
                  isDisabled={
                    revision.contentHash === currentHash || isDisabled
                  }
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
  );
};

export const RevisionsDrawer = ({
  draftId,
  currentHash,
  isOpen,
  onOpenChange,
  onRestore,
  isRestoring,
  isDisabled,
}: {
  draftId: number;
  /** A row holding this content has nothing to restore. */
  currentHash: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onRestore: (revisionId: number) => void;
  isRestoring: boolean;
  isDisabled: boolean;
}) => {
  // The drawer body only exists while the drawer is open, so the virtualizer
  // has to re-read it from state rather than a ref.
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(
    null
  );

  return (
    <Drawer.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <DrawerPanel>
        <Drawer.CloseTrigger />
        <Drawer.Header>
          <Drawer.Heading>Versions</Drawer.Heading>
        </Drawer.Header>
        <Drawer.Body ref={setScrollElement}>
          <Tabs defaultSelectedKey="commit">
            <Tabs.ListContainer>
              <Tabs.List aria-label="Versions">
                {KINDS.map(({ kind, label }) => (
                  <Tabs.Tab key={kind} id={kind}>
                    {label}
                    <Tabs.Indicator />
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs.ListContainer>
            {KINDS.map(({ kind, empty }) => (
              <Tabs.Panel key={kind} className="pt-4" id={kind}>
                <RevisionList
                  draftId={draftId}
                  kind={kind}
                  empty={empty}
                  currentHash={currentHash}
                  scrollElement={scrollElement}
                  onRestore={onRestore}
                  isRestoring={isRestoring}
                  isDisabled={isDisabled}
                />
              </Tabs.Panel>
            ))}
          </Tabs>
        </Drawer.Body>
      </DrawerPanel>
    </Drawer.Backdrop>
  );
};

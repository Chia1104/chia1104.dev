"use client";

import { useCallback, useState } from "react";

import {
  Button,
  Chip,
  Drawer,
  Modal,
  Spinner,
  Table,
  Tabs,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon, StarIcon } from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { toast } from "sonner";

import { MediaKind } from "@chia/db/types";
import { formatDateTime } from "@chia/utils/format";
import { Image } from "@chiastack/ui/image";

import { DrawerPanel } from "@/components/commons/drawer-panel";
import { orpc } from "@/libs/orpc/client";

import { AddDrawer } from "./add-drawer";
import { EntryForm } from "./entry-form";
import { KINDS, KIND_LABEL, STATUS_LABEL, titleOf } from "./form";
import type { MediaEntryView } from "./form";

/** Client-side oRPC. The log is one person's, small enough to list a kind in full. */

const COLUMNS = [
  { uid: "cover", name: "Cover", minWidth: 64 },
  { uid: "title", name: "Title", minWidth: 260 },
  { uid: "year", name: "Year", minWidth: 72 },
  { uid: "status", name: "Status", minWidth: 120 },
  { uid: "rating", name: "Rating", minWidth: 88 },
  { uid: "finishedOn", name: "Finished", minWidth: 120 },
];

const useInvalidateMedia = () => {
  const queryClient = useQueryClient();
  return useCallback(
    () => void queryClient.invalidateQueries({ queryKey: orpc.media.key() }),
    [queryClient]
  );
};

const DeleteConfirm = ({
  isOpen,
  isPending,
  onCancel,
  onConfirm,
}: {
  isOpen: boolean;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) => (
  <Modal>
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}>
      <Modal.Container placement="auto">
        <Modal.Dialog className="sm:max-w-md">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Remove this from the log?</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <p className="text-muted text-sm">
              The entry and its stored cover are deleted. You can log the work
              again from the catalogue later.
            </p>
          </Modal.Body>
          <Modal.Footer>
            <Button isDisabled={isPending} variant="ghost" onPress={onCancel}>
              Cancel
            </Button>
            <Button isPending={isPending} variant="danger" onPress={onConfirm}>
              Remove
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  </Modal>
);

const EntryDrawer = ({
  entry,
  onClose,
  onSynced,
}: {
  entry: MediaEntryView | null;
  onClose: () => void;
  /** The drawer stays open on the synced entry, so its owner swaps in the fresh row. */
  onSynced: (entry: MediaEntryView) => void;
}) => {
  const invalidate = useInvalidateMedia();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const update = useMutation(
    orpc.media.update.mutationOptions({
      onSuccess() {
        invalidate();
        onClose();
        toast.success("Entry saved");
      },
      onError(error) {
        toast.error(error.message);
      },
    })
  );

  const remove = useMutation(
    orpc.media.remove.mutationOptions({
      onSuccess() {
        invalidate();
        setConfirmDelete(false);
        onClose();
        toast.success("Entry removed");
      },
      onError(error) {
        toast.error(error.message);
      },
    })
  );

  const sync = useMutation(
    orpc.media.sync.mutationOptions({
      onSuccess(result) {
        invalidate();
        onSynced(result.entry);
        toast.success("Play stats synced from Steam");
      },
      onError(error) {
        toast.error(error.message);
      },
    })
  );

  const busy = update.isPending || remove.isPending || sync.isPending;

  return (
    <Drawer.Backdrop
      isOpen={entry !== null}
      onOpenChange={(open) => !open && onClose()}>
      <DrawerPanel>
        <Drawer.CloseTrigger />
        <Drawer.Header>
          <Drawer.Heading>{entry ? titleOf(entry) : null}</Drawer.Heading>
        </Drawer.Header>
        <Drawer.Body>
          {entry ? (
            <EntryForm
              // A sync changes the row behind the form; a new key reloads its fields.
              key={`${entry.id}:${entry.updatedAt.getTime()}`}
              entry={entry}
              isPending={busy}
              onSubmit={(write) => update.mutate({ id: entry.id, ...write })}
            />
          ) : null}
        </Drawer.Body>
        {entry ? (
          <Drawer.Footer className="justify-between">
            <span className="text-muted text-xs">
              updated {formatDateTime(entry.updatedAt)}
            </span>
            <div className="flex items-center gap-2">
              {entry.steamAppId === null ? null : (
                <Button
                  isDisabled={busy}
                  isPending={sync.isPending}
                  size="sm"
                  variant="secondary"
                  onPress={() => sync.mutate({ id: entry.id })}>
                  Sync from Steam
                </Button>
              )}
              <Button
                isDisabled={busy}
                size="sm"
                variant="danger-soft"
                onPress={() => setConfirmDelete(true)}>
                Remove
              </Button>
            </div>
          </Drawer.Footer>
        ) : null}
      </DrawerPanel>
      {entry ? (
        <DeleteConfirm
          isOpen={confirmDelete}
          isPending={remove.isPending}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => remove.mutate({ id: entry.id })}
        />
      ) : null}
    </Drawer.Backdrop>
  );
};

export const MediaManager = () => {
  const [kind, setKind] = useQueryState(
    "kind",
    parseAsStringLiteral(KINDS).withDefault(MediaKind.Movie)
  );
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<MediaEntryView | null>(null);
  const invalidate = useInvalidateMedia();

  const { data, isLoading } = useQuery(
    orpc.media.list.queryOptions({ input: { kind } })
  );
  const rows = data?.items ?? [];

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Tabs
          selectedKey={kind}
          onSelectionChange={(key) => {
            const next = KINDS.find((candidate) => candidate === key);
            if (next) void setKind(next);
          }}>
          <Tabs.ListContainer>
            <Tabs.List aria-label="Media kind">
              {KINDS.map((candidate) => (
                <Tabs.Tab key={candidate} id={candidate}>
                  {KIND_LABEL[candidate]}
                  <Tabs.Indicator />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
        <Button
          className="ml-auto"
          size="sm"
          variant="primary"
          onPress={() => setAdding(true)}>
          <PlusIcon className="size-3.5" />
          Log {KIND_LABEL[kind].toLowerCase()}
        </Button>
      </div>

      <Table>
        <Table.Content
          aria-label={`${KIND_LABEL[kind]} log`}
          className="rounded-2xl">
          <Table.Header>
            {COLUMNS.map((column) => (
              <Table.Column
                className="bg-surface-secondary"
                key={column.uid}
                id={column.uid}
                isRowHeader={column.uid === "title"}
                minWidth={column.minWidth}>
                {column.name}
              </Table.Column>
            ))}
          </Table.Header>
          <Table.Body
            renderEmptyState={() => (
              <div className="text-foreground/70 py-4 text-center text-sm">
                {isLoading ? (
                  <Spinner size="sm" />
                ) : (
                  `No ${KIND_LABEL[kind].toLowerCase()} logged yet`
                )}
              </div>
            )}>
            <Table.Collection items={rows}>
              {(entry) => (
                <Table.Row id={entry.id}>
                  <Table.Cell>
                    <div className="bg-default relative aspect-2/3 w-8 overflow-hidden rounded-sm">
                      {entry.posterUrl ? (
                        <Image.Root>
                          <Image.Resource
                            src={entry.posterUrl}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                        </Image.Root>
                      ) : null}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center gap-1">
                      <Button
                        className="max-w-72 justify-start truncate py-0 text-xs"
                        size="sm"
                        variant="ghost"
                        onPress={() => setEditing(entry)}>
                        {titleOf(entry)}
                      </Button>
                      {entry.favorite ? (
                        <StarIcon
                          aria-label="Favorite"
                          className="text-warning size-3.5 fill-current"
                        />
                      ) : null}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="font-mono text-xs">
                      {entry.releaseYear ?? "—"}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <Chip size="sm" variant="soft">
                      <Chip.Label className="text-xs">
                        {STATUS_LABEL[entry.status]}
                      </Chip.Label>
                    </Chip>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="font-mono text-xs">
                      {entry.rating ?? "—"}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="font-mono text-xs">
                      {entry.finishedOn ?? "—"}
                    </span>
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Collection>
          </Table.Body>
        </Table.Content>
      </Table>

      <AddDrawer
        isOpen={adding}
        kind={kind}
        onAdded={(entry) => {
          invalidate();
          setAdding(false);
          setEditing(entry);
        }}
        onClose={() => setAdding(false)}
      />
      <EntryDrawer
        entry={editing}
        onClose={() => setEditing(null)}
        onSynced={setEditing}
      />
    </div>
  );
};

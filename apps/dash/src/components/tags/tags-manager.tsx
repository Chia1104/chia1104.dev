"use client";

import { useCallback, useState } from "react";

import { Button, Drawer, Modal, Spinner, Table } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { Locale } from "@chia/db/types";
import { formatDateTime } from "@chia/utils/format";

import { DrawerPanel } from "@/components/commons/drawer-panel";
import { orpc } from "@/libs/orpc/client";

import { nameOf } from "./form";
import type { TagView } from "./form";
import { TagForm } from "./tag-form";

/** Client-side oRPC; writes are behind `adminGuard()`. The taxonomy is small enough to list in full. */

const COLUMNS = [
  { uid: "slug", name: "Slug", minWidth: 160 },
  { uid: "zh-TW", name: "中文", minWidth: 160 },
  { uid: "en", name: "English", minWidth: 160 },
  { uid: "feedCount", name: "Posts", minWidth: 72 },
  { uid: "updatedAt", name: "Updated", minWidth: 160 },
];

const useInvalidateTags = () => {
  const queryClient = useQueryClient();
  return useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: orpc.tags.key() }),
        // Feed reads carry tag names.
        queryClient.invalidateQueries({ queryKey: orpc.feeds.key() }),
      ]),
    [queryClient]
  );
};

type Editor = { mode: "create" } | { mode: "edit"; tag: TagView } | null;

const postsLabel = (count: number) =>
  count === 1 ? "1 post" : `${count} posts`;

const DeleteConfirm = ({
  tag,
  isOpen,
  isPending,
  onCancel,
  onConfirm,
}: {
  tag: TagView;
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
            <Modal.Heading>Delete “{nameOf(tag)}”?</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <p className="text-muted text-sm">
              {tag.feedCount > 0
                ? `It is removed from ${postsLabel(tag.feedCount)}. Their content is untouched.`
                : "No post carries it."}
            </p>
          </Modal.Body>
          <Modal.Footer>
            <Button isDisabled={isPending} variant="ghost" onPress={onCancel}>
              Cancel
            </Button>
            <Button isPending={isPending} variant="danger" onPress={onConfirm}>
              Delete
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  </Modal>
);

const TagDrawer = ({
  editor,
  onClose,
}: {
  editor: Editor;
  onClose: () => void;
}) => {
  const invalidate = useInvalidateTags();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const create = useMutation(
    orpc.tags.create.mutationOptions({
      async onSuccess(result) {
        await invalidate();
        onClose();
        toast.success(`Tag ${result.tag.slug} created`);
      },
      onError(error) {
        toast.error(error.message);
      },
    })
  );

  const update = useMutation(
    orpc.tags.update.mutationOptions({
      async onSuccess() {
        await invalidate();
        onClose();
        toast.success("Tag saved");
      },
      onError(error) {
        toast.error(error.message);
      },
    })
  );

  const remove = useMutation(
    orpc.tags.remove.mutationOptions({
      async onSuccess() {
        await invalidate();
        setConfirmDelete(false);
        onClose();
        toast.success("Tag deleted");
      },
      onError(error) {
        toast.error(error.message);
      },
    })
  );

  const tag = editor?.mode === "edit" ? editor.tag : undefined;
  const busy = create.isPending || update.isPending || remove.isPending;

  return (
    <Drawer.Backdrop
      isOpen={editor !== null}
      onOpenChange={(open) => !open && onClose()}>
      <DrawerPanel>
        <Drawer.CloseTrigger />
        <Drawer.Header>
          <Drawer.Heading>{tag ? nameOf(tag) : "New tag"}</Drawer.Heading>
        </Drawer.Header>
        <Drawer.Body>
          {editor ? (
            <TagForm
              key={tag?.id ?? "create"}
              tag={tag}
              isPending={busy}
              onSubmit={(write) =>
                tag
                  ? update.mutate({ id: tag.id, ...write })
                  : create.mutate(write)
              }
            />
          ) : null}
        </Drawer.Body>
        {tag ? (
          <Drawer.Footer className="justify-between">
            <span className="text-muted text-xs">
              {postsLabel(tag.feedCount)} · updated{" "}
              {formatDateTime(tag.updatedAt)}
            </span>
            <Button
              isDisabled={busy}
              size="sm"
              variant="danger-soft"
              onPress={() => setConfirmDelete(true)}>
              Delete
            </Button>
          </Drawer.Footer>
        ) : null}
      </DrawerPanel>
      {tag ? (
        <DeleteConfirm
          tag={tag}
          isOpen={confirmDelete}
          isPending={remove.isPending}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => remove.mutate({ id: tag.id })}
        />
      ) : null}
    </Drawer.Backdrop>
  );
};

export const TagsManager = () => {
  const [editor, setEditor] = useState<Editor>(null);
  const { data, isLoading } = useQuery(
    orpc.tags.list.queryOptions({ input: { includeUnpublished: true } })
  );
  const rows = data?.items ?? [];

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-muted text-xs">
          Both names are required: the site and the index read a tag in the
          reader's language. Attach tags to a post from its settings.
        </p>
        <Button
          className="ml-auto"
          size="sm"
          variant="primary"
          onPress={() => setEditor({ mode: "create" })}>
          <PlusIcon className="size-3.5" />
          New tag
        </Button>
      </div>

      <Table>
        <Table.Content aria-label="Tags" className="rounded-2xl">
          <Table.Header>
            {COLUMNS.map((column) => (
              <Table.Column
                className="bg-surface-secondary"
                key={column.uid}
                id={column.uid}
                isRowHeader={column.uid === "slug"}
                minWidth={column.minWidth}>
                {column.name}
              </Table.Column>
            ))}
          </Table.Header>
          <Table.Body
            renderEmptyState={() => (
              <div className="text-foreground/70 py-4 text-center text-sm">
                {isLoading ? <Spinner size="sm" /> : "No tags yet"}
              </div>
            )}>
            <Table.Collection items={rows}>
              {(tag) => (
                <Table.Row id={tag.id}>
                  <Table.Cell className="flex items-center">
                    <Button
                      className="max-w-64 justify-start truncate py-0 font-mono text-xs"
                      size="sm"
                      variant="ghost"
                      onPress={() => setEditor({ mode: "edit", tag })}>
                      {tag.slug}
                    </Button>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-xs">{nameOf(tag, Locale.zhTW)}</span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-xs">{nameOf(tag, Locale.En)}</span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="font-mono text-xs">{tag.feedCount}</span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-muted text-xs">
                      {formatDateTime(tag.updatedAt)}
                    </span>
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Collection>
          </Table.Body>
        </Table.Content>
      </Table>

      <TagDrawer editor={editor} onClose={() => setEditor(null)} />
    </div>
  );
};

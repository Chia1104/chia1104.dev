"use client";

import { useCallback, useState } from "react";

import {
  Button,
  Chip,
  Drawer,
  Modal,
  Spinner,
  Switch,
  Table,
  Tabs,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { toast } from "sonner";

import { Locale, ProfileEntryKind } from "@chia/db/types";

import { DrawerPanel } from "@/components/commons/drawer-panel";
import { orpc } from "@/libs/orpc/client";

import { EntryForm } from "./entry-form";
import { LOCALES, contentOf } from "./form";
import type { ProfileEntryView } from "./form";

/** Client-side oRPC behind `adminGuard()`. One section per kind; the whole profile is small enough to list in full. */

const KINDS = [
  ProfileEntryKind.Experience,
  ProfileEntryKind.Education,
  ProfileEntryKind.Project,
  ProfileEntryKind.About,
] as const;

const KIND_LABEL = {
  [ProfileEntryKind.About]: "About",
  [ProfileEntryKind.Experience]: "Experience",
  [ProfileEntryKind.Education]: "Education",
  [ProfileEntryKind.Project]: "Projects",
} satisfies Record<ProfileEntryKind, string>;

const KIND_HINT = {
  [ProfileEntryKind.About]:
    "Your self-introduction. Keep one published; the site and the agent read the first.",
  [ProfileEntryKind.Experience]:
    "Roles you have held, newest first by order. The markdown body is what you did there.",
  [ProfileEntryKind.Education]: "Schools and programmes.",
  [ProfileEntryKind.Project]:
    "Projects you took part in, at work or on your own. Not the pinned GitHub repos.",
} satisfies Record<ProfileEntryKind, string>;

const COLUMNS = [
  { uid: "sortOrder", name: "Order", minWidth: 64 },
  { uid: "title", name: "Title", minWidth: 240 },
  { uid: "detail", name: "Detail", minWidth: 280 },
  { uid: "locales", name: "Locales", minWidth: 96 },
  { uid: "published", name: "Published", minWidth: 96 },
  { uid: "updatedAt", name: "Updated", minWidth: 160 },
];

const titleOf = (entry: ProfileEntryView): string =>
  entry.data.translations[Locale.zhTW]?.title ??
  entry.data.translations[Locale.En]?.title ??
  "(untitled)";

const periodOf = (data: { startDate?: string; endDate?: string }) =>
  data.startDate === undefined
    ? null
    : `${data.startDate} – ${data.endDate ?? "now"}`;

const detailOf = (entry: ProfileEntryView): string => {
  switch (entry.kind) {
    case ProfileEntryKind.Experience:
    case ProfileEntryKind.Education:
      return [entry.data.organization, periodOf(entry.data)]
        .filter((part) => part !== null)
        .join(" · ");
    case ProfileEntryKind.Project:
      return [periodOf(entry.data), entry.data.stack.slice(0, 4).join(", ")]
        .filter((part) => part !== null && part !== "")
        .join(" · ");
    case ProfileEntryKind.About:
      return (
        entry.data.translations[Locale.zhTW]?.summary ??
        entry.data.translations[Locale.En]?.summary ??
        ""
      );
  }
};

const localesOf = (entry: ProfileEntryView): Locale[] =>
  LOCALES.filter((locale) => entry.data.translations[locale] !== undefined);

const formatDate = (value: Date | string) =>
  new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

const useInvalidateProfile = () => {
  const queryClient = useQueryClient();
  return useCallback(
    () => void queryClient.invalidateQueries({ queryKey: orpc.profile.key() }),
    [queryClient]
  );
};

type Editor =
  | { mode: "create" }
  | { mode: "edit"; entry: ProfileEntryView }
  | null;

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
            <Modal.Heading>Delete this entry?</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <p className="text-muted-foreground text-sm">
              It disappears from the profile. Unpublish instead if you may want
              it back.
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

const EntryDrawer = ({
  editor,
  kind,
  onClose,
}: {
  editor: Editor;
  kind: ProfileEntryKind;
  onClose: () => void;
}) => {
  const invalidate = useInvalidateProfile();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const create = useMutation(
    orpc.profile.create.mutationOptions({
      onSuccess() {
        invalidate();
        onClose();
        toast.success(`${KIND_LABEL[kind]} entry created`);
      },
      onError(error) {
        toast.error(error.message);
      },
    })
  );

  const update = useMutation(
    orpc.profile.update.mutationOptions({
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
    orpc.profile.remove.mutationOptions({
      onSuccess() {
        invalidate();
        setConfirmDelete(false);
        onClose();
        toast.success("Entry deleted");
      },
      onError(error) {
        toast.error(error.message);
      },
    })
  );

  const entry = editor?.mode === "edit" ? editor.entry : undefined;
  const busy = create.isPending || update.isPending || remove.isPending;

  return (
    <Drawer.Backdrop
      isOpen={editor !== null}
      onOpenChange={(open) => !open && onClose()}>
      <DrawerPanel>
        <Drawer.CloseTrigger />
        <Drawer.Header>
          <Drawer.Heading>
            {entry
              ? titleOf(entry)
              : `New ${KIND_LABEL[kind].toLowerCase()} entry`}
          </Drawer.Heading>
        </Drawer.Header>
        <Drawer.Body>
          {editor ? (
            <EntryForm
              key={entry?.id ?? "create"}
              entry={entry}
              isPending={busy}
              kind={kind}
              onSubmit={(write) =>
                entry
                  ? update.mutate({ id: entry.id, ...write })
                  : create.mutate(write)
              }
            />
          ) : null}
        </Drawer.Body>
        {entry ? (
          <Drawer.Footer className="justify-between">
            <span className="text-muted-foreground text-xs">
              updated {formatDate(entry.updatedAt)}
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

/** Flips `published` in place; the row is sent back whole because `data` has no partial write. */
const PublishedSwitch = ({ entry }: { entry: ProfileEntryView }) => {
  const invalidate = useInvalidateProfile();
  const update = useMutation(
    orpc.profile.update.mutationOptions({
      onSuccess(result) {
        invalidate();
        toast.success(
          result.entry.published ? "Entry published" : "Entry unpublished"
        );
      },
      onError(error) {
        toast.error(error.message);
      },
    })
  );
  return (
    <Switch
      aria-label={`Published: ${titleOf(entry)}`}
      isDisabled={update.isPending}
      isSelected={entry.published}
      onChange={(published) =>
        update.mutate({
          id: entry.id,
          published,
          sortOrder: entry.sortOrder,
          ...contentOf(entry),
        })
      }>
      <Switch.Content>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
      </Switch.Content>
    </Switch>
  );
};

export const ProfileManager = () => {
  const [kind, setKind] = useQueryState(
    "kind",
    parseAsStringLiteral(KINDS).withDefault(ProfileEntryKind.Experience)
  );
  const [editor, setEditor] = useState<Editor>(null);

  const { data, isLoading } = useQuery(
    orpc.profile.list.queryOptions({ input: { kind } })
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
            <Tabs.List aria-label="Profile section">
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
          onPress={() => setEditor({ mode: "create" })}>
          <PlusIcon className="size-3.5" />
          New {KIND_LABEL[kind].toLowerCase()}
        </Button>
      </div>

      <p className="text-muted-foreground text-xs">{KIND_HINT[kind]}</p>

      <Table>
        <Table.Content
          aria-label={`${KIND_LABEL[kind]} entries`}
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
                  `No ${KIND_LABEL[kind].toLowerCase()} entries yet`
                )}
              </div>
            )}>
            <Table.Collection items={rows}>
              {(entry) => (
                <Table.Row id={entry.id}>
                  <Table.Cell>
                    <span className="font-mono text-xs">{entry.sortOrder}</span>
                  </Table.Cell>
                  <Table.Cell className="flex items-center">
                    <Button
                      className="max-w-64 justify-start truncate py-0 text-xs"
                      size="sm"
                      variant="ghost"
                      onPress={() => setEditor({ mode: "edit", entry })}>
                      {titleOf(entry)}
                    </Button>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-muted-foreground line-clamp-1 max-w-80 text-xs">
                      {detailOf(entry)}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex gap-1">
                      {localesOf(entry).map((locale) => (
                        <Chip key={locale} size="sm" variant="soft">
                          <Chip.Label className="font-mono text-xs">
                            {locale}
                          </Chip.Label>
                        </Chip>
                      ))}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <PublishedSwitch entry={entry} />
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-muted-foreground text-xs">
                      {formatDate(entry.updatedAt)}
                    </span>
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Collection>
          </Table.Body>
        </Table.Content>
      </Table>

      <EntryDrawer
        editor={editor}
        kind={kind}
        onClose={() => setEditor(null)}
      />
    </div>
  );
};

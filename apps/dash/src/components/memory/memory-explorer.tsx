"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Button,
  Card,
  Chip,
  Drawer,
  Input,
  InputGroup,
  Label,
  ListBox,
  Modal,
  Select,
  Spinner,
  Table,
  TableLayout,
  TextField,
  Virtualizer,
} from "@heroui/react";
import { useDebouncedValue } from "@tanstack/react-pacer";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ExternalLinkIcon, SearchIcon, SparklesIcon } from "lucide-react";
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import { toast } from "sonner";

import { Markdown } from "@chia/agent-elements/markdown";

import { orpc } from "@/libs/orpc/client";
import type { RouterInputs, RouterOutputs } from "@/libs/orpc/types";

/**
 * Memory management. Every call is a client-side oRPC call behind `adminGuard()`; the page
 * decides nothing about authority. The pending-lessons card sits above the list because a
 * pending lesson is the one row whose review actually gates agent behaviour.
 */

type Query = RouterInputs["memory"]["list"];
type MemoryKind = NonNullable<Query["kind"]>;
type MemoryStatus = NonNullable<Query["status"]>;
type MemoryDetail = RouterOutputs["memory"]["get"]["memory"];

const ANY = "any";
const SEARCH_DEBOUNCE_MS = 300;

const KIND_VALUES = [ANY, "source", "fact", "lesson"] as const;
const STATUS_VALUES = [ANY, "active", "pending", "archived"] as const;

const KIND_OPTIONS: { id: (typeof KIND_VALUES)[number]; label: string }[] = [
  { id: ANY, label: "Any kind" },
  { id: "source", label: "Source" },
  { id: "fact", label: "Fact" },
  { id: "lesson", label: "Lesson" },
];

const STATUS_OPTIONS: { id: (typeof STATUS_VALUES)[number]; label: string }[] =
  [
    { id: ANY, label: "Any status" },
    { id: "active", label: "Active" },
    { id: "pending", label: "Pending" },
    { id: "archived", label: "Archived" },
  ];

const COLUMNS = [
  { uid: "kind", name: "Kind", minWidth: 96 },
  { uid: "status", name: "Status", minWidth: 96 },
  { uid: "title", name: "Title", minWidth: 288 },
  { uid: "preview", name: "Preview", minWidth: 320 },
  { uid: "source", name: "Source", minWidth: 160 },
  { uid: "updatedAt", name: "Updated", minWidth: 180 },
];

const STATUS_COLOR = {
  active: "success",
  pending: "warning",
  archived: "default",
} satisfies Record<MemoryStatus, "success" | "warning" | "default">;

const KindChip = ({ kind }: { kind: MemoryKind }) => (
  <Chip size="sm" variant="soft">
    <Chip.Label className="font-mono text-xs">{kind}</Chip.Label>
  </Chip>
);

const StatusChip = ({ status }: { status: MemoryStatus }) => (
  <Chip color={STATUS_COLOR[status]} size="sm" variant="soft">
    <Chip.Label className="text-xs">{status}</Chip.Label>
  </Chip>
);

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

const formatDate = (value: Date | string) =>
  new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

const useInvalidateMemory = () => {
  const queryClient = useQueryClient();
  return useCallback(
    () => void queryClient.invalidateQueries({ queryKey: orpc.memory.key() }),
    [queryClient]
  );
};

// ============================================
// Pending lessons
// ============================================

/**
 * The review gate (§3.6 of the plan): a lesson lands `pending` and reaches a prompt only
 * once someone has read it here and approved it.
 */
const PendingLessons = () => {
  const invalidate = useInvalidateMemory();
  const { data, isLoading } = useQuery(
    orpc.memory.list.queryOptions({
      input: { kind: "lesson", status: "pending", limit: 20 },
    })
  );

  const approve = useMutation(
    orpc.memory["lesson:approve"].mutationOptions({
      onSuccess(result) {
        invalidate();
        toast.success(`Approved: ${result.memory.title}`);
      },
      onError(error) {
        toast.error(error.message);
      },
    })
  );

  const archive = useMutation(
    orpc.memory.update.mutationOptions({
      onSuccess() {
        invalidate();
        toast.success("Lesson archived");
      },
      onError(error) {
        toast.error(error.message);
      },
    })
  );

  const items = data?.items ?? [];
  if (!isLoading && items.length === 0) return null;

  return (
    <Card className="w-full">
      <Card.Header>
        <Card.Title className="text-sm">Lessons awaiting review</Card.Title>
        <Card.Description className="text-xs">
          A lesson is injected into every future turn once approved. Nothing the
          agent extracted reaches a prompt before you have read it.
        </Card.Description>
      </Card.Header>
      <Card.Content className="flex flex-col gap-3">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Spinner size="sm" />
          </div>
        ) : (
          items.map((lesson) => (
            <div
              key={lesson.id}
              className="border-border flex flex-col gap-2 rounded-lg border p-3">
              <p className="text-sm font-medium">{lesson.title}</p>
              <p className="text-muted-foreground text-xs">{lesson.preview}</p>
              <div className="flex items-center gap-2">
                <Button
                  isPending={
                    approve.isPending && approve.variables?.id === lesson.id
                  }
                  size="sm"
                  variant="primary"
                  onPress={() => approve.mutate({ id: lesson.id })}>
                  Approve
                </Button>
                <Button
                  isPending={
                    archive.isPending && archive.variables?.id === lesson.id
                  }
                  size="sm"
                  variant="ghost"
                  onPress={() =>
                    archive.mutate({ id: lesson.id, status: "archived" })
                  }>
                  Archive
                </Button>
                {lesson.sessionId ? (
                  <span className="text-muted-foreground ml-auto font-mono text-xs">
                    from {lesson.sessionId.slice(0, 8)}…
                  </span>
                ) : null}
              </div>
            </div>
          ))
        )}
      </Card.Content>
    </Card>
  );
};

// ============================================
// Consolidate
// ============================================

/** Runs the reflection for a session that never committed — the second trigger in plan §7.1. */
const ConsolidateSession = () => {
  const [sessionId, setSessionId] = useState("");
  const consolidate = useMutation(
    orpc.memory.consolidate.mutationOptions({
      onSuccess() {
        setSessionId("");
        toast.info(
          "Reflection started — pending lessons appear above once it finishes"
        );
      },
      onError(error) {
        toast.error(error.message);
      },
    })
  );

  return (
    <div className="flex items-end gap-2">
      <TextField
        aria-label="Session id to consolidate"
        className="w-80"
        onChange={setSessionId}
        value={sessionId}>
        <Label className="text-xs">Extract lessons from a session</Label>
        <Input className="font-mono text-xs" placeholder="session id" />
      </TextField>
      <Button
        isDisabled={sessionId.trim().length === 0}
        isPending={consolidate.isPending}
        size="sm"
        variant="secondary"
        onPress={() => consolidate.mutate({ sessionId: sessionId.trim() })}>
        <SparklesIcon className="size-3.5" />
        Consolidate
      </Button>
    </div>
  );
};

// ============================================
// Detail drawer
// ============================================

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
            <Modal.Heading>Delete this memory?</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <p className="text-muted-foreground text-sm">
              It leaves the index on the next run and the agent can no longer
              find it. Archive instead if you may want it back.
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

const MemoryEditor = ({
  memory,
  onClose,
}: {
  memory: MemoryDetail;
  onClose: () => void;
}) => {
  const invalidate = useInvalidateMemory();
  const [title, setTitle] = useState(memory.title);
  const [content, setContent] = useState(memory.content);
  const [sourceUrl, setSourceUrl] = useState(memory.sourceUrl ?? "");
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // a refetch after a save must not clobber an edit in progress
  useEffect(() => {
    if (editing) return;
    setTitle(memory.title);
    setContent(memory.content);
    setSourceUrl(memory.sourceUrl ?? "");
  }, [editing, memory]);

  const update = useMutation(
    orpc.memory.update.mutationOptions({
      onSuccess() {
        invalidate();
        setEditing(false);
        toast.success("Memory saved — re-indexing");
      },
      onError(error) {
        toast.error(error.message);
      },
    })
  );

  const remove = useMutation(
    orpc.memory.remove.mutationOptions({
      onSuccess() {
        invalidate();
        setConfirmDelete(false);
        onClose();
        toast.success("Memory deleted");
      },
      onError(error) {
        toast.error(error.message);
      },
    })
  );

  const approve = useMutation(
    orpc.memory["lesson:approve"].mutationOptions({
      onSuccess() {
        invalidate();
        toast.success("Lesson approved");
      },
      onError(error) {
        toast.error(error.message);
      },
    })
  );

  const setStatus = (status: MemoryStatus) =>
    update.mutate({ id: memory.id, status });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <KindChip kind={memory.kind} />
        <StatusChip status={memory.status} />
        {memory.sourceUrl ? (
          <a
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs"
            href={memory.sourceUrl}
            rel="noreferrer noopener"
            target="_blank">
            {hostOf(memory.sourceUrl)}
            <ExternalLinkIcon className="size-3" />
          </a>
        ) : null}
      </div>

      <dl className="grid grid-cols-2 gap-2 text-xs">
        <dt className="text-muted-foreground">Session</dt>
        <dd className="truncate font-mono">{memory.sessionId ?? "—"}</dd>
        <dt className="text-muted-foreground">Created</dt>
        <dd>{formatDate(memory.createdAt)}</dd>
        <dt className="text-muted-foreground">Updated</dt>
        <dd>{formatDate(memory.updatedAt)}</dd>
      </dl>

      {editing ? (
        <div className="flex flex-col gap-3">
          <TextField aria-label="Title" onChange={setTitle} value={title}>
            <Label className="text-xs">Title</Label>
            <Input />
          </TextField>
          <TextField
            aria-label="Source URL"
            onChange={setSourceUrl}
            value={sourceUrl}>
            <Label className="text-xs">Source URL</Label>
            <Input className="font-mono text-xs" placeholder="https://" />
          </TextField>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Content (markdown)</Label>
            <InputGroup fullWidth>
              <InputGroup.TextArea
                className="font-mono text-xs"
                rows={14}
                value={content}
                onChange={(event) => setContent(event.target.value)}
              />
            </InputGroup>
          </div>
          <div className="flex gap-2">
            <Button
              isPending={update.isPending}
              size="sm"
              variant="primary"
              onPress={() =>
                update.mutate({
                  id: memory.id,
                  title,
                  content,
                  sourceUrl: sourceUrl.trim() === "" ? null : sourceUrl.trim(),
                })
              }>
              Save
            </Button>
            <Button
              isDisabled={update.isPending}
              size="sm"
              variant="ghost"
              onPress={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Content</span>
            <Card variant="tertiary" className="rounded-md p-3">
              <Card.Content>
                <Markdown text={memory.content} />
              </Card.Content>
            </Card>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onPress={() => setEditing(true)}>
              Edit
            </Button>
            {memory.kind === "lesson" && memory.status === "pending" ? (
              <Button
                isPending={approve.isPending}
                size="sm"
                variant="primary"
                onPress={() => approve.mutate({ id: memory.id })}>
                Approve lesson
              </Button>
            ) : null}
            {memory.status === "archived" ? (
              <Button
                isPending={update.isPending}
                size="sm"
                variant="ghost"
                onPress={() => setStatus("active")}>
                Restore
              </Button>
            ) : (
              <Button
                isPending={update.isPending}
                size="sm"
                variant="ghost"
                onPress={() => setStatus("archived")}>
                Archive
              </Button>
            )}
            <Button
              className="ml-auto"
              size="sm"
              variant="danger-soft"
              onPress={() => setConfirmDelete(true)}>
              Delete
            </Button>
          </div>
        </>
      )}

      <DeleteConfirm
        isOpen={confirmDelete}
        isPending={remove.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => remove.mutate({ id: memory.id })}
      />
    </div>
  );
};

const MemoryDetailDrawer = ({
  memoryId,
  onClose,
}: {
  memoryId: number | null;
  onClose: () => void;
}) => {
  const { data, isLoading, error } = useQuery(
    orpc.memory.get.queryOptions({
      input: { id: memoryId ?? 0 },
      enabled: memoryId !== null,
    })
  );

  return (
    <Drawer.Backdrop
      isOpen={memoryId !== null}
      onOpenChange={(open) => !open && onClose()}>
      <Drawer.Content placement="right">
        <Drawer.Dialog>
          <Drawer.CloseTrigger />
          <Drawer.Header>
            <Drawer.Heading>
              {data ? data.memory.title : `Memory #${memoryId}`}
            </Drawer.Heading>
          </Drawer.Header>
          <Drawer.Body>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Spinner size="sm" />
              </div>
            ) : error || !data ? (
              <p className="text-danger py-8 text-sm">
                {error?.message ?? "Could not load this memory"}
              </p>
            ) : (
              <MemoryEditor memory={data.memory} onClose={onClose} />
            )}
          </Drawer.Body>
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
};

// ============================================
// Explorer
// ============================================

export const MemoryExplorer = () => {
  const [params, setParams] = useQueryStates(
    {
      q: parseAsString.withDefault(""),
      kind: parseAsStringLiteral(KIND_VALUES).withDefault(ANY),
      status: parseAsStringLiteral(STATUS_VALUES).withDefault(ANY),
    },
    { history: "replace" }
  );
  const [openId, setOpenId] = useState<number | null>(null);
  const [debouncedSearch] = useDebouncedValue(params.q.trim(), {
    wait: SEARCH_DEBOUNCE_MS,
  });

  const filters = useMemo<Query>(() => {
    // SAFETY: The producer contract guarantees this value satisfies MemoryKind.
    const kind = params.kind === ANY ? undefined : (params.kind as MemoryKind);
    // SAFETY: The producer contract guarantees this value satisfies MemoryStatus.
    const status =
      params.status === ANY ? undefined : (params.status as MemoryStatus);
    return { query: debouncedSearch || undefined, kind, status };
  }, [debouncedSearch, params.kind, params.status]);

  const {
    data,
    isSuccess,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery(
    orpc.memory.list.infiniteOptions({
      input: (pageParam) => ({ ...filters, cursor: pageParam }),
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? null,
      initialPageParam:
        /* SAFETY: The producer contract guarantees this value satisfies number | null. */ null as
          | number
          | null,
    })
  );

  const rows = useMemo(
    () => (isSuccess && data ? data.pages.flatMap((page) => page.items) : []),
    [data, isSuccess]
  );

  return (
    <div className="flex w-full flex-col gap-6">
      <PendingLessons />

      <div className="flex flex-wrap items-end gap-2">
        <TextField
          aria-label="Search memories"
          className="relative min-w-56 flex-1"
          onChange={(value) => void setParams({ q: value.trim() || null })}
          value={params.q}>
          <div className="relative">
            <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 z-10 size-3.5 -translate-y-1/2" />
            <Input className="pl-8" placeholder="Search title and content..." />
          </div>
        </TextField>

        <Select
          aria-label="Memory kind"
          className="w-36"
          onChange={(key) =>
            void setParams({
              kind: /* SAFETY: The producer contract guarantees this value satisfies (typeof KIND_VALUES)[number]. */ String(
                key
              ) as (typeof KIND_VALUES)[number],
            })
          }
          value={params.kind}>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox items={KIND_OPTIONS}>
              {(item) => <ListBox.Item id={item.id}>{item.label}</ListBox.Item>}
            </ListBox>
          </Select.Popover>
        </Select>

        <Select
          aria-label="Memory status"
          className="w-36"
          onChange={(key) =>
            void setParams({
              status:
                /* SAFETY: The producer contract guarantees this value satisfies (typeof STATUS_VALUES)[number]. */ String(
                  key
                ) as (typeof STATUS_VALUES)[number],
            })
          }
          value={params.status}>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox items={STATUS_OPTIONS}>
              {(item) => <ListBox.Item id={item.id}>{item.label}</ListBox.Item>}
            </ListBox>
          </Select.Popover>
        </Select>

        <ConsolidateSession />
      </div>

      <Virtualizer layout={TableLayout} layoutOptions={{ rowHeight: 42 }}>
        <Table>
          <Table.Content
            aria-label="Agent memories"
            className="max-h-125 min-h-96 overflow-auto rounded-2xl">
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
                  {isLoading ? "Loading..." : "No memories match these filters"}
                </div>
              )}>
              <Table.Collection items={rows}>
                {(memory) => (
                  <Table.Row id={memory.id}>
                    <Table.Cell>
                      <KindChip kind={memory.kind} />
                    </Table.Cell>
                    <Table.Cell>
                      <StatusChip status={memory.status} />
                    </Table.Cell>
                    <Table.Cell className="flex items-center">
                      <Button
                        className="max-w-72 justify-start truncate py-0 text-xs"
                        size="sm"
                        variant="ghost"
                        onPress={() => setOpenId(memory.id)}>
                        {memory.title}
                      </Button>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-muted-foreground line-clamp-1 max-w-80 text-xs">
                        {memory.preview}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      {memory.sourceUrl ? (
                        <a
                          className="text-muted-foreground hover:text-foreground text-xs"
                          href={memory.sourceUrl}
                          rel="noreferrer noopener"
                          target="_blank">
                          {hostOf(memory.sourceUrl)}
                        </a>
                      ) : (
                        "—"
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-muted-foreground text-xs">
                        {formatDate(memory.updatedAt)}
                      </span>
                    </Table.Cell>
                  </Table.Row>
                )}
              </Table.Collection>
              {hasNextPage && isSuccess && (
                <Table.LoadMore
                  isLoading={isFetchingNextPage}
                  scrollOffset={0}
                  onLoadMore={() => fetchNextPage()}>
                  <Table.LoadMoreContent>
                    <Spinner size="sm" />
                  </Table.LoadMoreContent>
                </Table.LoadMore>
              )}
            </Table.Body>
          </Table.Content>
        </Table>
      </Virtualizer>

      <MemoryDetailDrawer memoryId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
};

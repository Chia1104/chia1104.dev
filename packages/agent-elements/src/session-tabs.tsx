"use client";

import { useMemo, useState } from "react";

import {
  AlertDialog,
  Button,
  Dropdown,
  Form,
  Input,
  Label,
  Modal,
  Popover,
  SearchField,
  ScrollShadow,
  TextField,
  Tooltip,
} from "@heroui/react";
import { Clock, Ellipsis, GitFork, Pencil, Plus, Trash2 } from "lucide-react";

import { cn } from "@chia/ui/utils/cn.util";

import { defaultAgentLabels, fill } from "./labels.ts";
import type { AgentLabels } from "./labels.ts";
import type { AgentSessionSummary } from "./types.ts";

/** Mirrors the contract's `title: z.string().max(200)`. */
export const SESSION_TITLE_MAX_LENGTH = 200;

type SessionTabsLabels = Pick<
  AgentLabels,
  | "cancel"
  | "deleteSession"
  | "deleteSessionDescription"
  | "deleteSessionTitle"
  | "forked"
  | "forkedFrom"
  | "moreSessions"
  | "newSession"
  | "noSessions"
  | "renameSession"
  | "renameSessionTitle"
  | "save"
  | "searchSessions"
  | "sessionActions"
  | "sessionTitleLabel"
  | "sessionTitlePlaceholder"
  | "untitledSession"
>;

export interface SessionTabsProps {
  sessions: readonly AgentSessionSummary[];
  activeId: string | null;
  onSelect: (sessionId: string) => void;
  onCreate: () => void;
  /** When given, every session gets a "Rename" action; the host persists and refreshes the list. */
  onRename?: (sessionId: string, title: string) => void | Promise<void>;
  /** When given, every session gets a "Delete" action; the host persists and refreshes the list. */
  onDelete?: (sessionId: string) => void | Promise<void>;
  isCreating?: boolean;
  visible?: number;
  formatTime?: (timestamp: number) => string;
  labels?: Partial<SessionTabsLabels>;
  className?: string;
}

const defaultFormatTime = (timestamp: number) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);

type SessionAction = "rename" | "delete";

interface PendingAction {
  type: SessionAction;
  session: AgentSessionSummary;
}

/**
 * Host owns the session list and the current selection.
 */
export const SessionTabs = ({
  activeId,
  className,
  formatTime = defaultFormatTime,
  isCreating,
  labels: overrides,
  onCreate,
  onDelete,
  onRename,
  onSelect,
  sessions,
  visible = 8,
}: SessionTabsProps) => {
  const labels = { ...defaultAgentLabels, ...overrides };
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<PendingAction | null>(null);

  const strip = sessions.slice(0, visible);
  const activeInStrip = strip.some((session) => session.id === activeId);
  const active = sessions.find((session) => session.id === activeId);
  // Keep the active session visible even when it has fallen out of the recent strip.
  const shown =
    active && !activeInStrip ? [active, ...strip.slice(0, visible - 1)] : strip;

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle
      ? sessions.filter((session) =>
          (session.title ?? labels.untitledSession)
            .toLowerCase()
            .includes(needle)
        )
      : sessions;
  }, [labels.untitledSession, query, sessions]);

  const pick = (sessionId: string) => {
    setOpen(false);
    setQuery("");
    onSelect(sessionId);
  };

  /** Where a fork came from, when the source is still listed; a bare marker otherwise. */
  const lineageOf = (session: AgentSessionSummary): string | null => {
    if (!session.forkedFromSessionId) return null;
    const source = sessions.find(
      (candidate) => candidate.id === session.forkedFromSessionId
    );
    return source
      ? fill(labels.forkedFrom, {
          title: source.title ?? labels.untitledSession,
        })
      : labels.forked;
  };

  const hasActions = Boolean(onRename || onDelete);

  const actions = (session: AgentSessionSummary, className?: string) =>
    hasActions ? (
      <SessionActions
        className={className}
        labels={labels}
        onAction={(type) => {
          setOpen(false);
          setPending({ type, session });
        }}
        withDelete={Boolean(onDelete)}
        withRename={Boolean(onRename)}
      />
    ) : null;

  return (
    <div className={cn("flex w-full min-w-0 items-center gap-2", className)}>
      <div className="shrink-0">
        <Tooltip>
          <Button
            aria-label={labels.newSession}
            isIconOnly
            className="shrink-0"
            isPending={isCreating}
            onPress={onCreate}
            size="sm"
            variant="secondary">
            <Plus className="size-4" />
          </Button>
          <Tooltip.Content>{labels.newSession}</Tooltip.Content>
        </Tooltip>
      </div>

      <div className="min-w-0 flex-1 overflow-hidden">
        <ScrollShadow
          className="w-full"
          hideScrollBar
          orientation="horizontal"
          size={16}>
          <div className="flex w-max items-center gap-0.5">
            {shown.map((session) => {
              const isActive = session.id === activeId;
              const lineage = lineageOf(session);
              return (
                <Button
                  render={(props) => <span {...props} />}
                  key={session.id}
                  className="group/tab h-8 w-40 shrink-0 items-center justify-between rounded-lg pr-0 pl-2 text-xs font-normal"
                  onPress={() => onSelect(session.id)}
                  size="sm"
                  variant={isActive ? "tertiary" : "ghost"}>
                  {lineage ? (
                    <GitFork
                      aria-label={lineage}
                      className="text-muted size-3 shrink-0"
                      role="img"
                    />
                  ) : null}
                  <span className="min-w-0 truncate">
                    {session.title ?? labels.untitledSession}
                  </span>
                  {actions(
                    session,
                    cn(
                      "mr-1 opacity-0 transition-opacity group-hover/tab:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100 data-[pressed]:opacity-100",
                      isActive && "opacity-100"
                    )
                  )}
                </Button>
              );
            })}
          </div>
        </ScrollShadow>
      </div>

      {sessions.length > shown.length ? (
        <div className="shrink-0">
          <Popover isOpen={open} onOpenChange={setOpen}>
            <Popover.Trigger>
              <Tooltip>
                <Button
                  aria-label={labels.moreSessions}
                  isIconOnly
                  className="text-muted h-8 shrink-0 gap-1 px-2.5 text-xs"
                  size="sm"
                  variant="ghost">
                  <Clock className="size-3.5" />
                </Button>
                <Tooltip.Content>{labels.moreSessions}</Tooltip.Content>
              </Tooltip>
            </Popover.Trigger>
            <Popover.Content
              className="bg-surface/70 w-80 p-0 backdrop-blur-sm"
              placement="bottom end">
              <Popover.Dialog className="flex flex-col p-0">
                <div className="border-border border-b p-2">
                  <SearchField
                    aria-label={labels.searchSessions}
                    autoFocus
                    fullWidth
                    onChange={setQuery}
                    value={query}>
                    <SearchField.Group>
                      <SearchField.SearchIcon />
                      <SearchField.Input placeholder={labels.searchSessions} />
                      <SearchField.ClearButton />
                    </SearchField.Group>
                  </SearchField>
                </div>
                <ScrollShadow className="max-h-80 p-1.5">
                  {matches.length === 0 ? (
                    <p className="text-muted px-3 py-6 text-center text-xs">
                      {labels.noSessions}
                    </p>
                  ) : (
                    <div className="flex flex-col">
                      {matches.map((session) => {
                        const lineage = lineageOf(session);
                        return (
                          <div
                            key={session.id}
                            className="group/row flex items-center gap-1">
                            <Button
                              className="h-auto min-w-0 flex-1 justify-start px-2.5 py-2 text-left"
                              onPress={() => pick(session.id)}
                              size="sm"
                              variant={
                                session.id === activeId ? "tertiary" : "ghost"
                              }>
                              <span className="flex min-w-0 flex-col gap-0.5">
                                <span className="text-foreground truncate text-sm font-normal">
                                  {session.title ?? labels.untitledSession}
                                </span>
                                <span className="text-muted flex items-center gap-1 text-[11px]">
                                  {formatTime(session.updatedAt)}
                                  {lineage ? (
                                    <>
                                      <span aria-hidden>·</span>
                                      <GitFork
                                        aria-hidden
                                        className="size-3 shrink-0"
                                      />
                                      <span className="truncate">
                                        {lineage}
                                      </span>
                                    </>
                                  ) : null}
                                </span>
                              </span>
                            </Button>
                            {actions(session, "shrink-0")}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollShadow>
              </Popover.Dialog>
            </Popover.Content>
          </Popover>
        </div>
      ) : null}

      {onRename ? (
        <RenameSessionDialog
          key={pending?.type === "rename" ? pending.session.id : "closed"}
          labels={labels}
          onClose={() => setPending(null)}
          onRename={onRename}
          session={pending?.type === "rename" ? pending.session : null}
        />
      ) : null}
      {onDelete ? (
        <DeleteSessionDialog
          labels={labels}
          onClose={() => setPending(null)}
          onDelete={onDelete}
          session={pending?.type === "delete" ? pending.session : null}
        />
      ) : null}
    </div>
  );
};

const SessionActions = ({
  className,
  labels,
  onAction,
  withDelete,
  withRename,
}: {
  className?: string;
  labels: SessionTabsLabels;
  onAction: (type: SessionAction) => void;
  withDelete: boolean;
  withRename: boolean;
}) => (
  <Dropdown>
    <Button
      aria-label={labels.sessionActions}
      className={cn("text-muted size-6 min-w-0 shrink-0", className)}
      isIconOnly
      size="sm"
      variant="ghost">
      <Ellipsis className="size-3.5" />
    </Button>
    <Dropdown.Popover className="min-w-36" placement="bottom end">
      <Dropdown.Menu
        aria-label={labels.sessionActions}
        onAction={(key) => {
          if (key === "rename" || key === "delete") onAction(key);
        }}>
        {withRename ? (
          <Dropdown.Item id="rename" textValue={labels.renameSession}>
            <Pencil className="size-3.5" />
            {labels.renameSession}
          </Dropdown.Item>
        ) : null}
        {withDelete ? (
          <Dropdown.Item
            id="delete"
            textValue={labels.deleteSession}
            variant="danger">
            <Trash2 className="size-3.5" />
            {labels.deleteSession}
          </Dropdown.Item>
        ) : null}
      </Dropdown.Menu>
    </Dropdown.Popover>
  </Dropdown>
);

/** Remounted per session (via `key`) so the field always opens on that session's current title. */
const RenameSessionDialog = ({
  labels,
  onClose,
  onRename,
  session,
}: {
  labels: SessionTabsLabels;
  onClose: () => void;
  onRename: NonNullable<SessionTabsProps["onRename"]>;
  session: AgentSessionSummary | null;
}) => {
  const [title, setTitle] = useState(session?.title ?? "");
  const [busy, setBusy] = useState(false);
  const trimmed = title.trim();
  const canSave =
    !busy && trimmed.length > 0 && trimmed.length <= SESSION_TITLE_MAX_LENGTH;

  const submit = async () => {
    if (!session || !canSave) return;
    setBusy(true);
    try {
      await onRename(session.id, trimmed);
      onClose();
    } catch {
      // The host reported the failure; the dialog stays open for another try.
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal.Backdrop
      isDismissable={!busy}
      isOpen={session !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}>
      <Modal.Container placement="auto">
        <Modal.Dialog className="sm:max-w-sm">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>{labels.renameSessionTitle}</Modal.Heading>
          </Modal.Header>
          <Form
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}>
            <Modal.Body>
              <TextField
                autoFocus
                fullWidth
                isDisabled={busy}
                maxLength={SESSION_TITLE_MAX_LENGTH}
                onChange={setTitle}
                value={title}
                variant="secondary">
                <Label>{labels.sessionTitleLabel}</Label>
                <Input placeholder={labels.sessionTitlePlaceholder} />
              </TextField>
            </Modal.Body>
            <Modal.Footer>
              <Button
                isDisabled={busy}
                onPress={onClose}
                size="sm"
                variant="tertiary">
                {labels.cancel}
              </Button>
              <Button
                isDisabled={!canSave}
                isPending={busy}
                size="sm"
                type="submit">
                {labels.save}
              </Button>
            </Modal.Footer>
          </Form>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
};

const DeleteSessionDialog = ({
  labels,
  onClose,
  onDelete,
  session,
}: {
  labels: SessionTabsLabels;
  onClose: () => void;
  onDelete: NonNullable<SessionTabsProps["onDelete"]>;
  session: AgentSessionSummary | null;
}) => {
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    if (!session) return;
    setBusy(true);
    try {
      await onDelete(session.id);
      onClose();
    } catch {
      // The host reported the failure; the dialog stays open for another try.
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog.Backdrop
      isOpen={session !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen && !busy) onClose();
      }}>
      <AlertDialog.Container>
        <AlertDialog.Dialog className="sm:max-w-sm">
          <AlertDialog.CloseTrigger />
          <AlertDialog.Header>
            <AlertDialog.Icon status="danger" />
            <AlertDialog.Heading>
              {labels.deleteSessionTitle}
            </AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body>
            <p className="text-foreground truncate text-sm font-medium">
              {session?.title ?? labels.untitledSession}
            </p>
            <p className="text-muted text-sm">
              {labels.deleteSessionDescription}
            </p>
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button
              isDisabled={busy}
              onPress={onClose}
              size="sm"
              variant="tertiary">
              {labels.cancel}
            </Button>
            <Button
              isPending={busy}
              onPress={() => void confirm()}
              size="sm"
              variant="danger">
              {labels.deleteSession}
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
};

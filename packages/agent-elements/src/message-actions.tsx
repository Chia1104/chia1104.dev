"use client";

import type { ComponentType } from "react";
import { useState } from "react";

import {
  AlertDialog,
  Button,
  Card,
  Checkbox,
  Form,
  Input,
  Label,
  Modal,
  TextField,
  Tooltip,
} from "@heroui/react";
import { GitFork, Undo2 } from "lucide-react";

import { cn } from "@chia/ui/utils/cn.util";

import { useAgentLabels } from "./labels-context.tsx";
import {
  useAgentSession,
  useCanPrompt,
  useForkSession,
  useNavigateSession,
} from "./provider.tsx";
import { SESSION_TITLE_MAX_LENGTH } from "./session-tabs.tsx";

export interface MessageActionsProps {
  messageId: string;
  role: "user" | "assistant";
  text: string;
  className?: string;
}

type PendingAction = "rewind" | "fork" | null;

/** Offered only while the session can take a prompt; both actions are refused server-side mid-turn. */
export const MessageActions = ({
  className,
  messageId,
  role,
  text,
}: MessageActionsProps) => {
  const labels = useAgentLabels();
  const canPrompt = useCanPrompt();
  const [pending, setPending] = useState<PendingAction>(null);
  if (!canPrompt) return null;

  const close = () => setPending(null);
  return (
    <span className={cn("flex items-center gap-0.5", className)}>
      {role === "user" ? (
        <ActionButton
          icon={Undo2}
          label={labels.editAndResend}
          onPress={() => setPending("rewind")}
        />
      ) : null}
      <ActionButton
        icon={GitFork}
        label={labels.forkFromHere}
        onPress={() => setPending("fork")}
      />
      {/* Remounted per opening (via `key`) so each dialog starts from its defaults. */}
      {role === "user" ? (
        <RewindDialog
          key={pending === "rewind" ? "open-rewind" : "closed-rewind"}
          isOpen={pending === "rewind"}
          messageId={messageId}
          onClose={close}
          text={text}
        />
      ) : null}
      <ForkDialog
        key={pending === "fork" ? "open-fork" : "closed-fork"}
        isOpen={pending === "fork"}
        messageId={messageId}
        onClose={close}
        position={role === "user" ? "before" : "at"}
      />
    </span>
  );
};

const ActionButton = ({
  icon: Icon,
  label,
  onPress,
}: {
  icon: ComponentType<{
    className?: string;
    "aria-hidden"?: boolean;
    strokeWidth?: number;
  }>;
  label: string;
  onPress: () => void;
}) => (
  <Tooltip delay={300}>
    <Tooltip.Trigger>
      <Button
        aria-label={label}
        className="text-default-600 size-6 min-w-6"
        isIconOnly
        onPress={onPress}
        size="sm"
        variant="ghost">
        <Icon
          aria-hidden
          className="text-default-600 stroke-default-600 size-3.5"
          strokeWidth={1}
        />
      </Button>
    </Tooltip.Trigger>
    <Tooltip.Content placement="top">{label}</Tooltip.Content>
  </Tooltip>
);

/** On success, the message text is handed to the composer. */
const RewindDialog = ({
  isOpen,
  messageId,
  onClose,
  text,
}: {
  isOpen: boolean;
  messageId: string;
  onClose: () => void;
  text: string;
}) => {
  const labels = useAgentLabels();
  const navigate = useNavigateSession();
  const seedComposer = useAgentSession((state) => state.seedComposer);
  const [summarize, setSummarize] = useState(false);

  const confirm = async () => {
    try {
      await navigate.mutateAsync({ entryId: messageId, summarize });
      seedComposer(text);
      onClose();
    } catch {
      // Reported through the store; the dialog stays open for another try.
    }
  };

  return (
    <AlertDialog.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open && !navigate.isPending) onClose();
      }}>
      <AlertDialog.Container>
        <AlertDialog.Dialog className="sm:max-w-sm">
          <AlertDialog.CloseTrigger />
          <AlertDialog.Header>
            <AlertDialog.Icon status="warning" />
            <AlertDialog.Heading>{labels.rewindTitle}</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body className="gap-3">
            <Card
              variant="tertiary"
              className="mb-3 max-h-40 overflow-y-auto p-3">
              <Card.Content>
                <p className="text-foreground text-sm font-medium">{text}</p>
              </Card.Content>
            </Card>
            <p className="text-muted mb-3 text-sm">
              {labels.rewindDescription}
            </p>
            <Checkbox
              variant="secondary"
              isDisabled={navigate.isPending}
              isSelected={summarize}
              onChange={setSummarize}>
              <Checkbox.Content>
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
                <Label className="text-muted text-xs">
                  {labels.rewindSummarize}
                </Label>
              </Checkbox.Content>
            </Checkbox>
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button
              isDisabled={navigate.isPending}
              onPress={onClose}
              size="sm"
              variant="tertiary">
              {labels.cancel}
            </Button>
            <Button
              isPending={navigate.isPending}
              onPress={() => void confirm()}
              size="sm">
              {labels.rewind}
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
};

/** Title is optional and defaults to this session's. */
const ForkDialog = ({
  isOpen,
  messageId,
  onClose,
  position,
}: {
  isOpen: boolean;
  messageId: string;
  onClose: () => void;
  position: "before" | "at";
}) => {
  const labels = useAgentLabels();
  const fork = useForkSession();
  const [title, setTitle] = useState("");
  const trimmed = title.trim();
  const canSubmit =
    !fork.isPending && trimmed.length <= SESSION_TITLE_MAX_LENGTH;

  const submit = async () => {
    if (!canSubmit) return;
    try {
      await fork.mutateAsync({
        entryId: messageId,
        position,
        title: trimmed || undefined,
      });
      onClose();
    } catch {
      // Reported through the store; the dialog stays open for another try.
    }
  };

  return (
    <Modal.Backdrop
      isDismissable={!fork.isPending}
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}>
      <Modal.Container placement="auto">
        <Modal.Dialog className="sm:max-w-sm">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>{labels.forkTitle}</Modal.Heading>
          </Modal.Header>
          <Form
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}>
            <Modal.Body className="gap-3">
              <p className="text-muted text-sm">{labels.forkDescription}</p>
              <TextField
                autoFocus
                fullWidth
                isDisabled={fork.isPending}
                maxLength={SESSION_TITLE_MAX_LENGTH}
                onChange={setTitle}
                value={title}
                variant="secondary">
                <Label>{labels.sessionTitleLabel}</Label>
                <Input placeholder={labels.forkTitlePlaceholder} />
              </TextField>
            </Modal.Body>
            <Modal.Footer>
              <Button
                isDisabled={fork.isPending}
                onPress={onClose}
                size="sm"
                variant="tertiary">
                {labels.cancel}
              </Button>
              <Button
                isDisabled={!canSubmit}
                isPending={fork.isPending}
                size="sm"
                type="submit">
                {labels.fork}
              </Button>
            </Modal.Footer>
          </Form>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
};

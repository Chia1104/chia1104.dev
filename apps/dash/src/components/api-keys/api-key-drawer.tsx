"use client";

import { useState } from "react";

import {
  Button,
  Card,
  Checkbox,
  CheckboxGroup,
  Description,
  Drawer,
  FieldError,
  Form,
  Input,
  Label,
  Modal,
  Surface,
  TextField,
} from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { CopyButton } from "@chia/ui/copy-button";

import { DrawerPanel } from "@/components/commons/drawer-panel";
import { orpc } from "@/libs/orpc/client";

import {
  SCOPES,
  SCOPE_HINT,
  apiKeyFormSchema,
  emptyFormValues,
  formValuesOf,
  stateOf,
} from "./form";
import type { ApiKeyFormInput, ApiKeyFormOutput, ApiKeyView } from "./form";
import {
  KeyStateChip,
  ScopeChips,
  formatDateTime,
  useInvalidateApiKeys,
} from "./shared";

/**
 * The raw key exists only in the create response, so the drawer keeps it on screen until the
 * operator closes it. Revoke is better-auth's `enabled: false`; there is no re-enable.
 */

export type Editor =
  | { mode: "create" }
  | { mode: "edit"; item: ApiKeyView }
  | null;

/** Fields sit on the drawer's overlay surface; `secondary` is the variant that stays visible there in dark mode. */
const FIELD_VARIANT = "secondary";

const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <>
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="truncate">{value}</dd>
  </>
);

const ConfirmDialog = ({
  isOpen,
  isPending,
  title,
  body,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  isOpen: boolean;
  isPending: boolean;
  title: string;
  body: string;
  confirmLabel: string;
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
            <Modal.Heading>{title}</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <p className="text-muted-foreground text-sm">{body}</p>
          </Modal.Body>
          <Modal.Footer>
            <Button isDisabled={isPending} variant="ghost" onPress={onCancel}>
              Cancel
            </Button>
            <Button isPending={isPending} variant="danger" onPress={onConfirm}>
              {confirmLabel}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  </Modal>
);

const ApiKeyForm = ({
  item,
  isPending,
  submitLabel,
  onSubmit,
}: {
  item?: ApiKeyView;
  isPending: boolean;
  submitLabel: string;
  onSubmit: (write: ApiKeyFormOutput) => void;
}) => {
  const { control, handleSubmit } = useForm<
    ApiKeyFormInput,
    unknown,
    ApiKeyFormOutput
  >({
    resolver: zodResolver(apiKeyFormSchema),
    defaultValues: item ? formValuesOf(item) : emptyFormValues(),
  });

  return (
    <Form
      onSubmit={handleSubmit((write) => onSubmit(write))}
      className="flex flex-col gap-4">
      <Controller
        control={control}
        name="name"
        render={({ field, fieldState }) => (
          <TextField
            isDisabled={isPending}
            isInvalid={fieldState.invalid}
            onBlur={field.onBlur}
            onChange={field.onChange}
            value={field.value}>
            <Label className="text-xs">Name</Label>
            <Input
              placeholder="Where this key lives, like www on Vercel"
              variant={FIELD_VARIANT}
            />
            <FieldError>{fieldState.error?.message}</FieldError>
          </TextField>
        )}
      />
      <Controller
        control={control}
        name="scopes"
        render={({ field, fieldState }) => (
          <CheckboxGroup
            variant="secondary"
            aria-label="Scopes"
            className="gap-2"
            isDisabled={isPending}
            isInvalid={fieldState.invalid}
            onBlur={field.onBlur}
            onChange={field.onChange}
            value={field.value}>
            <Label className="text-xs">Scopes</Label>
            <Description className="text-xs">
              A request is refused unless the key carries every scope the route
              asks for.
            </Description>
            {SCOPES.map((scope) => (
              <Checkbox key={scope} value={scope}>
                <Checkbox.Content className="items-start">
                  <Checkbox.Control className="mt-0.5">
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-mono text-xs">{scope}</span>
                    <span className="text-muted-foreground text-xs">
                      {SCOPE_HINT[scope]}
                    </span>
                  </div>
                </Checkbox.Content>
              </Checkbox>
            ))}
            <FieldError>{fieldState.error?.message}</FieldError>
          </CheckboxGroup>
        )}
      />
      <Button
        className="self-end"
        isPending={isPending}
        size="sm"
        type="submit"
        variant="primary">
        {submitLabel}
      </Button>
    </Form>
  );
};

const RevealedKey = ({ secret }: { secret: string }) => (
  <Card className="w-full" variant="secondary">
    <Card.Header>
      <Card.Title className="text-sm">Copy the key now</Card.Title>
      <Card.Description className="text-xs">
        It is shown once. Close this panel and it is gone for good.
      </Card.Description>
    </Card.Header>
    <Card.Content>
      <Surface
        className="flex items-center justify-between gap-3 rounded-lg p-3 font-mono text-xs break-all"
        variant="tertiary">
        <span>{secret}</span>
        <CopyButton
          content={secret}
          translations={{ copied: "Copied", copy: "Copy" }}
        />
      </Surface>
    </Card.Content>
  </Card>
);

const CreateView = ({ onClose }: { onClose: () => void }) => {
  const invalidate = useInvalidateApiKeys();
  const create = useMutation(
    orpc.apikey.create.mutationOptions({
      async onSuccess() {
        await invalidate();
        toast.success("API key created");
      },
      onError(error) {
        toast.error(error.message);
      },
    })
  );

  if (create.isSuccess) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-base font-semibold">{create.data.name}</span>
          <ScopeChips permissions={create.data.permissions} />
        </div>
        <RevealedKey secret={create.data.key} />
        <Button
          className="self-end"
          size="sm"
          variant="primary"
          onPress={onClose}>
          Done
        </Button>
      </div>
    );
  }

  return (
    <ApiKeyForm
      isPending={create.isPending}
      submitLabel="Create key"
      onSubmit={(write) => create.mutate(write)}
    />
  );
};

const DetailView = ({
  item,
  onClose,
}: {
  item: ApiKeyView;
  onClose: () => void;
}) => {
  const invalidate = useInvalidateApiKeys();
  const [dialog, setDialog] = useState<"revoke" | "delete" | null>(null);
  const state = stateOf(item);

  const failed = (error: Error) => toast.error(error.message);

  const update = useMutation(
    orpc.apikey.update.mutationOptions({
      async onSuccess() {
        await invalidate();
        toast.success("API key saved");
      },
      onError: failed,
    })
  );
  const revoke = useMutation(
    orpc.apikey.revoke.mutationOptions({
      async onSuccess() {
        await invalidate();
        setDialog(null);
        toast.success("API key revoked");
      },
      onError: failed,
    })
  );
  const remove = useMutation(
    orpc.apikey.delete.mutationOptions({
      async onSuccess() {
        await invalidate();
        setDialog(null);
        toast.success("API key deleted");
        onClose();
      },
      onError: failed,
    })
  );

  const busy = update.isPending || revoke.isPending || remove.isPending;

  return (
    <div className="flex flex-col gap-5">
      <Card className="w-full" variant="secondary">
        <Card.Header className="flex-row items-center justify-between">
          <Card.Title className="text-sm">Key</Card.Title>
          <KeyStateChip state={state} />
        </Card.Header>
        <Card.Content>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <Field
              label="Prefix"
              value={<span className="font-mono">{item.start ?? "—"}…</span>}
            />
            <Field label="Requests" value={item.requestCount ?? 0} />
            <Field label="Created" value={formatDateTime(item.createdAt)} />
            <Field
              label="Last used"
              value={
                item.lastRequest ? formatDateTime(item.lastRequest) : "Never"
              }
            />
            <Field
              label="Expires"
              value={item.expiresAt ? formatDateTime(item.expiresAt) : "Never"}
            />
            <Field
              label="Id"
              value={<span className="font-mono">{item.id}</span>}
            />
          </dl>
        </Card.Content>
      </Card>

      <ApiKeyForm
        key={item.updatedAt}
        isPending={busy}
        item={item}
        submitLabel="Save"
        onSubmit={(write) => update.mutate({ keyId: item.id, ...write })}
      />

      <ConfirmDialog
        body="Requests with this key are refused from now on. It cannot be re-enabled; create a new key instead."
        confirmLabel="Revoke"
        isOpen={dialog === "revoke"}
        isPending={revoke.isPending}
        title="Revoke this key?"
        onCancel={() => setDialog(null)}
        onConfirm={() => revoke.mutate(item.id)}
      />
      <ConfirmDialog
        body="The key and its usage record are removed. There is no undo."
        confirmLabel="Delete"
        isOpen={dialog === "delete"}
        isPending={remove.isPending}
        title="Delete this key?"
        onCancel={() => setDialog(null)}
        onConfirm={() => remove.mutate(item.id)}
      />

      <div className="flex flex-wrap gap-2">
        {state === "active" ? (
          <Button
            isDisabled={busy}
            size="sm"
            variant="danger-soft"
            onPress={() => setDialog("revoke")}>
            Revoke
          </Button>
        ) : null}
        <Button
          className="ml-auto"
          isDisabled={busy}
          size="sm"
          variant="danger-soft"
          onPress={() => setDialog("delete")}>
          Delete
        </Button>
      </div>
    </div>
  );
};

export const ApiKeyDrawer = ({
  editor,
  onClose,
}: {
  editor: Editor;
  onClose: () => void;
}) => {
  const item = editor?.mode === "edit" ? editor.item : undefined;
  return (
    <Drawer.Backdrop
      isOpen={editor !== null}
      onOpenChange={(open) => !open && onClose()}>
      <DrawerPanel className="md:max-w-xl">
        <Drawer.CloseTrigger />
        <Drawer.Header>
          <Drawer.Heading>
            {item ? (item.name ?? "API key") : "New API key"}
          </Drawer.Heading>
        </Drawer.Header>
        <Drawer.Body>
          {editor?.mode === "create" ? (
            <CreateView key="create" onClose={onClose} />
          ) : item ? (
            <DetailView key={item.id} item={item} onClose={onClose} />
          ) : null}
        </Drawer.Body>
      </DrawerPanel>
    </Drawer.Backdrop>
  );
};

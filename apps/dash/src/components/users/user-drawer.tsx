"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  Avatar,
  Button,
  Card,
  Chip,
  Drawer,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  Spinner,
  TextField,
} from "@heroui/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { authClient } from "@chia/auth/client";

import { orpc } from "@/libs/orpc/client";
import type { RouterOutputs } from "@/libs/orpc/types";

import {
  RoleChip,
  UserStateChip,
  formatDateTime,
  formatUsd,
  useInvalidateUsers,
} from "./shared";

/**
 * Reads come from oRPC; every write is a better-auth admin endpoint, so ban, revoke and
 * delete semantics are the auth server's, not the dashboard's.
 */

type UserDetail = RouterOutputs["user"]["get"];
type UserUsage = RouterOutputs["agent"]["admin"]["usage"]["user"];

const DAY_SECONDS = 60 * 60 * 24;

const BAN_DURATIONS = [
  { id: "1", label: "1 day", seconds: DAY_SECONDS },
  { id: "7", label: "7 days", seconds: 7 * DAY_SECONDS },
  { id: "30", label: "30 days", seconds: 30 * DAY_SECONDS },
  { id: "forever", label: "Until unbanned", seconds: undefined },
] as const;

type BanDurationId = (typeof BAN_DURATIONS)[number]["id"];

/** better-auth's client reports failure in `error` rather than throwing. */
const unwrap = async <T,>(
  request: Promise<{ data: T; error: { message?: string } | null }>
): Promise<T> => {
  const result = await request;
  if (result.error) {
    throw new Error(result.error.message ?? "The auth server refused");
  }
  return result.data;
};

const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <>
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="truncate">{value}</dd>
  </>
);

const BanDialog = ({
  isOpen,
  isPending,
  onCancel,
  onConfirm,
}: {
  isOpen: boolean;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: (input: { reason: string; expiresIn?: number }) => void;
}) => {
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState<BanDurationId>("forever");
  return (
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
              <Modal.Heading>Ban this user?</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-4">
              <p className="text-muted-foreground text-sm">
                Every session is signed out and sign-in is refused until the ban
                ends. The reason is shown to them.
              </p>
              <TextField
                aria-label="Ban reason"
                isDisabled={isPending}
                maxLength={200}
                onChange={setReason}
                value={reason}>
                <Label className="text-xs">Reason</Label>
                <Input placeholder="Why they are banned" />
              </TextField>
              <Select
                aria-label="Ban duration"
                className="w-full"
                isDisabled={isPending}
                onChange={(key) =>
                  /* SAFETY: The listbox only offers ids from BAN_DURATIONS. */ setDuration(
                    String(key) as BanDurationId
                  )
                }
                value={duration}>
                <Label className="text-xs">Duration</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox items={BAN_DURATIONS}>
                    {(item) => (
                      <ListBox.Item id={item.id}>{item.label}</ListBox.Item>
                    )}
                  </ListBox>
                </Select.Popover>
              </Select>
            </Modal.Body>
            <Modal.Footer>
              <Button isDisabled={isPending} variant="ghost" onPress={onCancel}>
                Cancel
              </Button>
              <Button
                isPending={isPending}
                variant="danger"
                onPress={() =>
                  onConfirm({
                    reason: reason.trim(),
                    expiresIn: BAN_DURATIONS.find((d) => d.id === duration)
                      ?.seconds,
                  })
                }>
                Ban
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};

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

const UsageCard = ({ userId }: { userId: string }) => {
  const { data, isLoading, error } = useQuery(
    orpc.agent.admin.usage.user.queryOptions({ input: { userId } })
  );
  return (
    <Card className="w-full" variant="secondary">
      <Card.Header>
        <Card.Title className="text-sm">Agent usage</Card.Title>
      </Card.Header>
      <Card.Content>
        {isLoading ? (
          <Spinner size="sm" />
        ) : error || !data ? (
          <p className="text-danger text-xs">
            {error?.message ?? "Could not load usage"}
          </p>
        ) : (
          <UsageFields usage={data} />
        )}
      </Card.Content>
    </Card>
  );
};

const UsageFields = ({ usage }: { usage: UserUsage }) => (
  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
    <Field
      label="This week"
      value={`${formatUsd(usage.houseUsd)} of ${formatUsd(usage.weeklyLimitUsd)}`}
    />
    <Field label="Turns this week" value={usage.turns} />
    <Field label="All time, any bill" value={formatUsd(usage.allTimeUsd)} />
    <Field label="Sessions kept" value={usage.sessions} />
    <Field
      label="Week resets"
      value={`${formatDateTime(usage.period.end)} (${usage.period.timeZone})`}
    />
  </dl>
);

const UserDetailView = ({
  detail,
  onClose,
}: {
  detail: UserDetail;
  onClose: () => void;
}) => {
  const router = useRouter();
  const invalidate = useInvalidateUsers();
  const me = authClient.useSession();
  const [dialog, setDialog] = useState<"ban" | "revoke" | "delete" | null>(
    null
  );
  const { user, accounts } = detail;
  const isSelf = me.data?.user.id === user.id;

  const done = (message: string) => async () => {
    await invalidate();
    setDialog(null);
    toast.success(message);
  };
  const failed = (error: Error) => toast.error(error.message);

  const ban = useMutation({
    mutationFn: (input: { reason: string; expiresIn?: number }) =>
      unwrap(
        authClient.admin.banUser({
          userId: user.id,
          banReason: input.reason || undefined,
          banExpiresIn: input.expiresIn,
        })
      ),
    onSuccess: done("User banned"),
    onError: failed,
  });
  const unban = useMutation({
    mutationFn: () => unwrap(authClient.admin.unbanUser({ userId: user.id })),
    onSuccess: done("User unbanned"),
    onError: failed,
  });
  const revoke = useMutation({
    mutationFn: () =>
      unwrap(authClient.admin.revokeUserSessions({ userId: user.id })),
    onSuccess: done("Every session signed out"),
    onError: failed,
  });
  const impersonate = useMutation({
    mutationFn: () =>
      unwrap(authClient.admin.impersonateUser({ userId: user.id })),
    onSuccess() {
      toast.success(`Browsing as ${user.name}. Stop from the banner.`);
      onClose();
      router.refresh();
    },
    onError: failed,
  });
  const remove = useMutation({
    mutationFn: () => unwrap(authClient.admin.removeUser({ userId: user.id })),
    async onSuccess() {
      await invalidate();
      setDialog(null);
      toast.success("User deleted");
      onClose();
    },
    onError: failed,
  });

  const busy =
    ban.isPending ||
    unban.isPending ||
    revoke.isPending ||
    impersonate.isPending ||
    remove.isPending;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Avatar className="size-12">
          <Avatar.Image alt={user.name} src={user.image ?? undefined} />
          <Avatar.Fallback>{user.name.slice(0, 1)}</Avatar.Fallback>
        </Avatar>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-base font-semibold">{user.name}</span>
          <span className="text-muted-foreground truncate text-xs">
            {user.email}
          </span>
          <div className="flex flex-wrap gap-1">
            <RoleChip role={user.role} />
            <UserStateChip
              banned={user.banned}
              isAnonymous={user.isAnonymous}
            />
            {isSelf && (
              <Chip size="sm" variant="soft">
                <Chip.Label>you</Chip.Label>
              </Chip>
            )}
          </div>
        </div>
      </div>

      {user.banned && (
        <Card className="w-full" variant="secondary">
          <Card.Content className="flex flex-col gap-1 py-3 text-xs">
            <span className="font-medium">Banned</span>
            <span className="text-muted-foreground">
              {user.banReason ?? "No reason recorded"}
              {" · "}
              {user.banExpires
                ? `until ${formatDateTime(user.banExpires)}`
                : "until unbanned"}
            </span>
          </Card.Content>
        </Card>
      )}

      <Card className="w-full" variant="secondary">
        <Card.Header>
          <Card.Title className="text-sm">Account</Card.Title>
        </Card.Header>
        <Card.Content>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <Field
              label="Id"
              value={<span className="font-mono">{user.id}</span>}
            />
            <Field
              label="Email verified"
              value={user.emailVerified ? "Yes" : "No"}
            />
            <Field label="Joined" value={formatDateTime(user.createdAt)} />
            <Field label="Updated" value={formatDateTime(user.updatedAt)} />
            <Field
              label="Sign-in providers"
              value={
                accounts.length === 0
                  ? "—"
                  : accounts.map((account) => account.providerId).join(", ")
              }
            />
            <Field label="Passkeys" value={detail.passkeys} />
            <Field label="API keys" value={detail.apiKeys} />
          </dl>
        </Card.Content>
      </Card>

      <UsageCard userId={user.id} />

      <div className="flex flex-wrap gap-2">
        {user.banned ? (
          <Button
            isDisabled={busy}
            isPending={unban.isPending}
            size="sm"
            variant="secondary"
            onPress={() => unban.mutate()}>
            Unban
          </Button>
        ) : (
          <Button
            isDisabled={busy || isSelf}
            size="sm"
            variant="danger-soft"
            onPress={() => setDialog("ban")}>
            Ban
          </Button>
        )}
        <Button
          isDisabled={busy}
          size="sm"
          variant="secondary"
          onPress={() => setDialog("revoke")}>
          Sign out everywhere
        </Button>
        <Button
          isDisabled={busy || isSelf}
          isPending={impersonate.isPending}
          size="sm"
          variant="secondary"
          onPress={() => impersonate.mutate()}>
          Impersonate
        </Button>
        <Button
          className="ml-auto"
          isDisabled={busy || isSelf}
          size="sm"
          variant="danger-soft"
          onPress={() => setDialog("delete")}>
          Delete
        </Button>
      </div>

      <BanDialog
        isOpen={dialog === "ban"}
        isPending={ban.isPending}
        onCancel={() => setDialog(null)}
        onConfirm={(input) => ban.mutate(input)}
      />
      <ConfirmDialog
        body="Every device is signed out. They can sign in again right away."
        confirmLabel="Sign out"
        isOpen={dialog === "revoke"}
        isPending={revoke.isPending}
        title="Sign this user out everywhere?"
        onCancel={() => setDialog(null)}
        onConfirm={() => revoke.mutate()}
      />
      <ConfirmDialog
        body="Their sessions, linked providers, agent sessions, usage and any content they authored go with them. There is no undo."
        confirmLabel="Delete"
        isOpen={dialog === "delete"}
        isPending={remove.isPending}
        title="Delete this user?"
        onCancel={() => setDialog(null)}
        onConfirm={() => remove.mutate()}
      />
    </div>
  );
};

export const UserDrawer = ({
  userId,
  onClose,
}: {
  userId: string | null;
  onClose: () => void;
}) => {
  const { data, isLoading, error } = useQuery(
    orpc.user.get.queryOptions({
      input: { id: userId ?? "" },
      enabled: userId !== null,
    })
  );

  return (
    <Drawer.Backdrop
      isOpen={userId !== null}
      onOpenChange={(open) => !open && onClose()}>
      <Drawer.Content placement="right">
        <Drawer.Dialog>
          <Drawer.CloseTrigger />
          <Drawer.Header>
            <Drawer.Heading>{data ? data.user.name : "User"}</Drawer.Heading>
          </Drawer.Header>
          <Drawer.Body>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Spinner size="sm" />
              </div>
            ) : error || !data ? (
              <p className="text-danger py-8 text-sm">
                {error?.message ?? "Could not load this user"}
              </p>
            ) : (
              <UserDetailView detail={data} onClose={onClose} />
            )}
          </Drawer.Body>
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
};

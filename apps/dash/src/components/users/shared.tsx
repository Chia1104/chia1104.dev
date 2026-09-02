"use client";

import { useCallback } from "react";

import { Chip } from "@heroui/react";
import { useQueryClient } from "@tanstack/react-query";

import { Role } from "@chia/db/types";

import { orpc } from "@/libs/orpc/client";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

export const formatUsd = (value: number) => usd.format(value);

export const formatDateTime = (value: string | Date) =>
  new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

const ROLE_COLOR = {
  [Role.Root]: "danger",
  [Role.Admin]: "accent",
  [Role.User]: "default",
} as const satisfies Record<Role, string>;

export const RoleChip = ({ role }: { role: string }) => (
  <Chip
    color={
      ROLE_COLOR[
        /* SAFETY: The producer contract guarantees this value satisfies Role. */ role as Role
      ] ?? "default"
    }
    size="sm"
    variant="soft">
    <Chip.Label>{role}</Chip.Label>
  </Chip>
);

export const UserStateChip = ({
  banned,
  isAnonymous,
}: {
  banned: boolean;
  isAnonymous: boolean;
}) =>
  banned ? (
    <Chip color="danger" size="sm" variant="soft">
      <Chip.Label>Banned</Chip.Label>
    </Chip>
  ) : isAnonymous ? (
    <Chip color="warning" size="sm" variant="soft">
      <Chip.Label>Guest</Chip.Label>
    </Chip>
  ) : (
    <Chip color="success" size="sm" variant="soft">
      <Chip.Label>Active</Chip.Label>
    </Chip>
  );

/** A write through better-auth changes what every user read and the overview show. */
export const useInvalidateUsers = () => {
  const queryClient = useQueryClient();
  return useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: orpc.user.key() }),
        queryClient.invalidateQueries({ queryKey: orpc.dashboard.key() }),
        queryClient.invalidateQueries({ queryKey: orpc.agent.admin.key() }),
      ]),
    [queryClient]
  );
};

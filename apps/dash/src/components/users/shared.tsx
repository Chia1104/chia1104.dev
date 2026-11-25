"use client";

import { useCallback } from "react";

import { Chip } from "@heroui/react";
import { useQueryClient } from "@tanstack/react-query";

import { orpc } from "@/libs/orpc/client";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

export const formatUsd = (value: number) => usd.format(value);

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

/** A user write changes what every user read and the overview show. */
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

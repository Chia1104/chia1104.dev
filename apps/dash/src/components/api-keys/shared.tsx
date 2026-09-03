"use client";

import { useCallback } from "react";

import { Chip } from "@heroui/react";
import { useQueryClient } from "@tanstack/react-query";

import { toApiKeyScopes } from "@chia/auth/apikey";

import { orpc } from "@/libs/orpc/client";

import type { ApiKeyState, ApiKeyView } from "./form";

export const formatDateTime = (value: string | Date) =>
  new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

const STATE_CHIP = {
  active: { color: "success", label: "Active" },
  revoked: { color: "danger", label: "Revoked" },
  expired: { color: "warning", label: "Expired" },
} as const satisfies Record<ApiKeyState, { color: string; label: string }>;

export const KeyStateChip = ({ state }: { state: ApiKeyState }) => (
  <Chip color={STATE_CHIP[state].color} size="sm" variant="soft">
    <Chip.Label>{STATE_CHIP[state].label}</Chip.Label>
  </Chip>
);

export const ScopeChips = ({
  permissions,
}: {
  permissions: ApiKeyView["permissions"];
}) => {
  const scopes = toApiKeyScopes(permissions);
  if (scopes.length === 0) {
    return <span className="text-muted-foreground text-xs">No scopes</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {scopes.map((scope) => (
        <Chip key={scope} size="sm" variant="soft">
          <Chip.Label className="font-mono text-xs">{scope}</Chip.Label>
        </Chip>
      ))}
    </div>
  );
};

/** A key write also changes the count shown on the user drawer. */
export const useInvalidateApiKeys = () => {
  const queryClient = useQueryClient();
  return useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: orpc.apikey.key() }),
        queryClient.invalidateQueries({ queryKey: orpc.user.key() }),
      ]),
    [queryClient]
  );
};

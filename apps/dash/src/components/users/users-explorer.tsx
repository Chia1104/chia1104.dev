"use client";

import { useMemo } from "react";

import {
  Avatar,
  Button,
  Input,
  ListBox,
  Select,
  Spinner,
  Table,
  TableLayout,
  TextField,
  Virtualizer,
} from "@heroui/react";
import { useDebouncedValue } from "@tanstack/react-pacer";
import { useInfiniteQuery } from "@tanstack/react-query";
import { SearchIcon } from "lucide-react";
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";

import { Role } from "@chia/db/types";

import { orpc } from "@/libs/orpc/client";
import type { RouterInputs, RouterOutputs } from "@/libs/orpc/types";

import { RoleChip, UserStateChip, formatDateTime } from "./shared";
import { UserDrawer } from "./user-drawer";

/** Client-side oRPC behind `adminGuard()`. `?open=<id>` deep-links a user so the overview can point here. */

type Query = RouterInputs["user"]["list"];
type UserRow = RouterOutputs["user"]["list"]["items"][number];

const ANY = "any";
const SEARCH_DEBOUNCE_MS = 300;

const ROLE_VALUES = [ANY, Role.User, Role.Admin, Role.Root] as const;
const STATE_VALUES = [ANY, "active", "banned"] as const;
const KIND_VALUES = [ANY, "account", "guest"] as const;

const ROLE_OPTIONS: { id: (typeof ROLE_VALUES)[number]; label: string }[] = [
  { id: ANY, label: "Any role" },
  { id: Role.User, label: "User" },
  { id: Role.Admin, label: "Admin" },
  { id: Role.Root, label: "Root" },
];

const STATE_OPTIONS: { id: (typeof STATE_VALUES)[number]; label: string }[] = [
  { id: ANY, label: "Any status" },
  { id: "active", label: "Active" },
  { id: "banned", label: "Banned" },
];

const KIND_OPTIONS: { id: (typeof KIND_VALUES)[number]; label: string }[] = [
  { id: ANY, label: "Accounts and guests" },
  { id: "account", label: "Accounts" },
  { id: "guest", label: "Guests" },
];

const COLUMNS = [
  { uid: "user", name: "User", minWidth: 190 },
  { uid: "role", name: "Role", minWidth: 96 },
  { uid: "state", name: "Status", minWidth: 96 },
  { uid: "createdAt", name: "Joined", minWidth: 176 },
] as const;

const FilterSelect = <T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) => (
  <Select
    aria-label={label}
    className="w-44"
    onChange={(key) =>
      /* SAFETY: The listbox only offers the ids in `options`. */ onChange(
        String(key) as T
      )
    }
    value={value}>
    <Select.Trigger>
      <Select.Value />
      <Select.Indicator />
    </Select.Trigger>
    <Select.Popover>
      <ListBox items={options}>
        {(item) => <ListBox.Item id={item.id}>{item.label}</ListBox.Item>}
      </ListBox>
    </Select.Popover>
  </Select>
);

export const UsersExplorer = () => {
  const [params, setParams] = useQueryStates(
    {
      q: parseAsString.withDefault(""),
      role: parseAsStringLiteral(ROLE_VALUES).withDefault(ANY),
      state: parseAsStringLiteral(STATE_VALUES).withDefault(ANY),
      kind: parseAsStringLiteral(KIND_VALUES).withDefault(ANY),
      open: parseAsString,
    },
    { history: "replace" }
  );
  const [debouncedSearch] = useDebouncedValue(params.q.trim(), {
    wait: SEARCH_DEBOUNCE_MS,
  });

  const filters = useMemo<Query>(
    () => ({
      query: debouncedSearch || undefined,
      role: params.role === ANY ? undefined : params.role,
      banned: params.state === ANY ? undefined : params.state === "banned",
      anonymous: params.kind === ANY ? undefined : params.kind === "guest",
    }),
    [debouncedSearch, params.role, params.state, params.kind]
  );

  const {
    data,
    error,
    isSuccess,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery(
    orpc.user.list.infiniteOptions({
      input: (pageParam) => ({ ...filters, cursor: pageParam }),
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? null,
      initialPageParam:
        /* SAFETY: The producer contract guarantees this value satisfies string | null. */ null as
          | string
          | null,
    })
  );

  const rows = useMemo(
    () => (isSuccess && data ? data.pages.flatMap((page) => page.items) : []),
    [data, isSuccess]
  );

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-wrap items-end gap-2">
        <TextField
          aria-label="Search users"
          className="relative min-w-56 flex-1"
          onChange={(value) => void setParams({ q: value.trim() || null })}
          value={params.q}>
          <div className="relative">
            <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 z-10 size-3.5 -translate-y-1/2" />
            <Input className="pl-8" placeholder="Search name or email..." />
          </div>
        </TextField>
        <FilterSelect
          label="Role"
          onChange={(role) => void setParams({ role })}
          options={ROLE_OPTIONS}
          value={params.role}
        />
        <FilterSelect
          label="Status"
          onChange={(state) => void setParams({ state })}
          options={STATE_OPTIONS}
          value={params.state}
        />
        <FilterSelect
          label="Account kind"
          onChange={(kind) => void setParams({ kind })}
          options={KIND_OPTIONS}
          value={params.kind}
        />
      </div>

      <Virtualizer layout={TableLayout}>
        <Table>
          <Table.ScrollContainer>
            <Table.Content
              aria-label="Users"
              className="max-h-125 min-h-96 overflow-auto rounded-2xl">
              <Table.Header>
                {COLUMNS.map((column) => (
                  <Table.Column
                    className="bg-surface-secondary"
                    key={column.uid}
                    id={column.uid}
                    isRowHeader={column.uid === "user"}
                    minWidth={column.minWidth}>
                    {column.name}
                  </Table.Column>
                ))}
              </Table.Header>
              <Table.Body
                renderEmptyState={() => (
                  <div
                    className={
                      error
                        ? "text-danger py-4 text-center text-sm"
                        : "text-foreground/70 py-4 text-center text-sm"
                    }>
                    {isLoading
                      ? "Loading..."
                      : (error?.message ?? "No users match these filters")}
                  </div>
                )}>
                <Table.Collection items={rows}>
                  {(user: UserRow) => (
                    <Table.Row id={user.id}>
                      <Table.Cell className="flex items-center">
                        <Button
                          className="h-auto w-full justify-start px-1 py-1 text-left"
                          size="sm"
                          variant="ghost"
                          onPress={() => void setParams({ open: user.id })}>
                          <Avatar className="size-7">
                            <Avatar.Image
                              alt={user.name}
                              src={user.image ?? undefined}
                            />
                            <Avatar.Fallback>
                              {user.name.slice(0, 1)}
                            </Avatar.Fallback>
                          </Avatar>
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate text-sm font-medium">
                              {user.name}
                            </span>
                            <span className="text-muted-foreground truncate text-xs">
                              {user.email}
                            </span>
                          </div>
                        </Button>
                      </Table.Cell>
                      <Table.Cell className="flex items-center">
                        <RoleChip role={user.role} />
                      </Table.Cell>
                      <Table.Cell className="flex items-center">
                        <UserStateChip
                          banned={user.banned}
                          isAnonymous={user.isAnonymous}
                        />
                      </Table.Cell>
                      <Table.Cell className="flex items-center">
                        <span className="text-muted-foreground text-xs">
                          {formatDateTime(user.createdAt)}
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
          </Table.ScrollContainer>
        </Table>
      </Virtualizer>

      <UserDrawer
        userId={params.open}
        onClose={() => void setParams({ open: null })}
      />
    </div>
  );
};

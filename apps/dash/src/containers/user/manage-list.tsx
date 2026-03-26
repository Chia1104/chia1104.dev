"use client";

import { useCallback, useMemo, memo } from "react";

import { Chip, Spinner, Table } from "@heroui/react";
import { useInfiniteQuery } from "@tanstack/react-query";

import { Role } from "@chia/db/types";
import DateFormat from "@chia/ui/date-format";

import { orpc } from "@/libs/orpc/client";
import type { RouterOutputs, RouterInputs } from "@/libs/orpc/types";

type Users = RouterOutputs["user"]["list"]["items"];
type Query = RouterInputs["user"]["list"];

interface Props {
  initUsers?: Users;
  nextCursor?: string | number | null;
  query?: Partial<Query>;
}

const COLUMNS = [
  { name: "Name", uid: "name" },
  { name: "Email", uid: "email" },
  { name: "Role", uid: "role" },
  { name: "Status", uid: "banned" },
  { name: "Joined", uid: "createdAt" },
] as const;

const ROLE_VARIANT = {
  [Role.Root]: "secondary",
  [Role.Admin]: "primary",
  [Role.User]: "soft",
} as const satisfies Record<Role, string>;

const ROLE_COLOR = {
  [Role.Root]: "danger",
  [Role.Admin]: "accent",
  [Role.User]: "default",
} as const satisfies Record<Role, string>;

type ColumnUid = (typeof COLUMNS)[number]["uid"];

const UserTablePrimitive = memo(
  ({
    data,
    hasNextPage,
    isLoading,
    onLoadMore,
  }: {
    data: Users;
    hasNextPage?: boolean;
    isLoading?: boolean;
    onLoadMore?: () => void;
  }) => {
    const renderCell = useCallback((item: Users[0], key: ColumnUid) => {
      switch (key) {
        case "name":
          return (
            <div className="flex flex-col">
              <p className="text-sm font-semibold">{item.name ?? "—"}</p>
            </div>
          );
        case "email":
          return (
            <div className="flex flex-col">
              <p className="text-foreground/70 text-sm">{item.email}</p>
            </div>
          );
        case "role":
          return (
            <Chip
              variant={ROLE_VARIANT[item.role as Role] ?? "secondary"}
              color={ROLE_COLOR[item.role as Role] ?? "default"}>
              {item.role}
            </Chip>
          );
        case "banned":
          return (
            <Chip
              variant={item.banned ? "secondary" : "primary"}
              color={item.banned ? "danger" : "success"}>
              {item.banned ? "Banned" : "Active"}
            </Chip>
          );
        case "createdAt":
          return (
            <span className="text-foreground/70 text-sm">
              <DateFormat date={item.createdAt} format="YYYY-MM-DD" />
            </span>
          );
        default:
          return null;
      }
    }, []);

    return (
      <div className="flex w-full flex-col gap-5">
        <div className="flex items-center justify-between gap-5">
          <h3 className="text-lg font-bold">Users</h3>
        </div>
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label="Users">
              <Table.Header>
                {COLUMNS.map((column) => (
                  <Table.Column
                    key={column.uid}
                    id={column.uid}
                    isRowHeader={column.uid === "name"}>
                    {column.name}
                  </Table.Column>
                ))}
              </Table.Header>
              <Table.Body
                renderEmptyState={() => (
                  <div className="text-foreground/70 py-4 text-center text-sm">
                    {isLoading ? "Loading..." : "No users found"}
                  </div>
                )}>
                <Table.Collection items={data}>
                  {(item) => (
                    <Table.Row id={item.id}>
                      {COLUMNS.map((column) => (
                        <Table.Cell key={column.uid}>
                          {renderCell(item, column.uid)}
                        </Table.Cell>
                      ))}
                    </Table.Row>
                  )}
                </Table.Collection>
                {hasNextPage && (
                  <Table.LoadMore
                    isLoading={isLoading}
                    scrollOffset={0}
                    onLoadMore={onLoadMore}>
                    <Table.LoadMoreContent>
                      <Spinner size="sm" />
                    </Table.LoadMoreContent>
                  </Table.LoadMore>
                )}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      </div>
    );
  }
);

UserTablePrimitive.displayName = "UserTablePrimitive";

export const ManageList = ({ initUsers, nextCursor, query }: Props) => {
  const {
    data,
    isSuccess,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery(
    orpc.user.list.infiniteOptions({
      input: (pageParam) => ({
        ...query,
        cursor: pageParam,
      }),
      getNextPageParam: (lastPage: RouterOutputs["user"]["list"]) =>
        lastPage?.nextCursor ? lastPage.nextCursor.toString() : null,
      initialData: initUsers
        ? {
            pages: [
              {
                items: initUsers,
                nextCursor: nextCursor?.toString() ?? null,
              },
            ],
            pageParams: [nextCursor?.toString() ?? null],
          }
        : undefined,
      initialPageParam: nextCursor?.toString() ?? null,
    })
  );

  const flatData = useMemo(() => {
    if (!isSuccess || !data) return [];
    return data.pages.flatMap((page) => page.items);
  }, [data, isSuccess]);

  return (
    <UserTablePrimitive
      data={flatData}
      hasNextPage={hasNextPage}
      isLoading={isLoading || isFetchingNextPage}
      onLoadMore={() => void fetchNextPage()}
    />
  );
};

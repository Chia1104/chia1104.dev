"use client";

import Link from "next/link";

import { Avatar, Card, Spinner } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/libs/orpc/client";
import type { RouterOutputs } from "@/libs/orpc/types";

import { RunStatusChip } from "../rag/rag-shared";
import { formatDateTime, formatUsd } from "../users/shared";

type UsageWeek = RouterOutputs["agent"]["admin"]["usage"]["week"];

const StatCard = ({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) => (
  <Card className="w-full">
    <Card.Content className="flex flex-col gap-1 py-4">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
    </Card.Content>
  </Card>
);

const SectionHeading = ({
  title,
  action,
}: {
  title: string;
  action?: { href: string; label: string };
}) => (
  <div className="flex items-center justify-between gap-4">
    <h2 className="text-lg font-semibold">{title}</h2>
    {action && (
      <Link
        className="text-muted-foreground hover:text-foreground text-sm"
        href={action.href}>
        {action.label}
      </Link>
    )}
  </div>
);

const TopUsers = ({ users }: { users: UsageWeek["topUsers"] }) => (
  <Card className="w-full">
    <Card.Header>
      <Card.Title className="text-sm">Top spenders this week</Card.Title>
      <Card.Description className="text-xs">
        House-gateway spend only; a bring-your-own-key call is their own bill.
      </Card.Description>
    </Card.Header>
    <Card.Content className="divide-border divide-y">
      {users.length === 0 ? (
        <p className="text-muted-foreground py-2 text-sm">No spend yet</p>
      ) : (
        users.map((user) => (
          <Link
            key={user.userId}
            className="hover:bg-surface-secondary -mx-2 flex items-center gap-3 rounded-lg px-2 py-2"
            href={`/users?open=${user.userId}`}>
            <Avatar className="size-7">
              <Avatar.Image alt={user.name} src={user.image ?? undefined} />
              <Avatar.Fallback>{user.name.slice(0, 1)}</Avatar.Fallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm">
                {user.name}
                {user.isAnonymous && (
                  <span className="text-muted-foreground"> · guest</span>
                )}
              </span>
              <span className="text-muted-foreground truncate text-xs">
                {user.email}
              </span>
            </div>
            <span className="font-mono text-xs tabular-nums">
              {formatUsd(user.houseUsd)} · {user.turns} turn
              {user.turns === 1 ? "" : "s"}
            </span>
          </Link>
        ))
      )}
    </Card.Content>
  </Card>
);

export const DashboardOverview = () => {
  const overview = useQuery(orpc.dashboard.overview.queryOptions());
  const usage = useQuery(orpc.agent.admin.usage.week.queryOptions());

  if (overview.isLoading || usage.isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  const error = overview.error ?? usage.error;
  if (error || !overview.data || !usage.data) {
    return (
      <p className="text-danger py-8 text-sm">
        {error?.message ?? "Could not load the overview"}
      </p>
    );
  }

  const { users, content, latestIndexRun } = overview.data;
  const week = usage.data;

  return (
    <div className="flex w-full flex-col gap-10">
      <section className="flex flex-col gap-4">
        <SectionHeading
          title="Users"
          action={{ href: "/users", label: "Manage users" }}
        />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Accounts and guests" value={users.total} />
          <StatCard label="New in 7 days" value={users.newThisWeek} />
          <StatCard
            hint="signed in without an account"
            label="Guests"
            value={users.guests}
          />
          <StatCard label="Banned" value={users.banned} />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading
          title="Agent this week"
          action={{ href: "/agents", label: "Quota settings" }}
        />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <StatCard
            hint={`resets ${formatDateTime(week.period.end)} (${week.period.timeZone})`}
            label="House spend"
            value={formatUsd(week.houseUsd)}
          />
          <StatCard
            hint="per user, house gateway only"
            label="Weekly allowance"
            value={formatUsd(week.weeklyLimitUsd)}
          />
          <StatCard label="Turns" value={week.turns} />
        </div>
        <TopUsers users={week.topUsers} />
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading
          title="Content"
          action={{ href: "/feed/posts", label: "Open content" }}
        />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Published posts" value={content.posts} />
          <StatCard label="Published notes" value={content.notes} />
          <StatCard label="Drafts" value={content.drafts} />
          <Card className="w-full">
            <Card.Content className="flex flex-col gap-1 py-4">
              <span className="text-muted-foreground text-xs">
                Latest index run
              </span>
              {latestIndexRun ? (
                <>
                  <div className="flex items-center gap-2">
                    <RunStatusChip status={latestIndexRun.status} />
                    <span className="text-muted-foreground font-mono text-xs">
                      {latestIndexRun.scope}
                    </span>
                  </div>
                  <Link
                    className="text-muted-foreground hover:text-foreground text-xs"
                    href="/rag/runs">
                    {formatDateTime(latestIndexRun.createdAt)}
                  </Link>
                </>
              ) : (
                <span className="text-muted-foreground text-sm">None yet</span>
              )}
            </Card.Content>
          </Card>
        </div>
      </section>
    </div>
  );
};

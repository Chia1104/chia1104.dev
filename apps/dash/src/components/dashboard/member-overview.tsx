"use client";

import Link from "next/link";

import { Avatar, Card, Label, ProgressBar, Spinner } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";

import { usageFractionOf } from "@chia/agent-elements/usage";
import { authClient } from "@chia/auth/client";

import { orpc } from "@/libs/orpc/client";

import { formatDateTime, formatUsd } from "../users/shared";

const MICROS_PER_USD = 1_000_000;

/** What a signed-in person who is not the operator sees: themselves and their allowance. */
export const MemberOverview = () => {
  const session = authClient.useSession();
  const usage = useQuery(orpc.agent.usage.me.queryOptions());

  if (session.isPending || usage.isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  const user = session.data?.user;
  const standing = usage.data;
  const fraction = standing ? usageFractionOf(standing) : null;
  const percent = fraction === null ? null : Math.round(fraction * 100);

  return (
    <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2">
      <Card className="w-full">
        <Card.Header>
          <Card.Title className="text-sm">Profile</Card.Title>
        </Card.Header>
        <Card.Content className="flex items-center gap-3">
          <Avatar className="size-10">
            <Avatar.Image alt={user?.name} src={user?.image ?? undefined} />
            <Avatar.Fallback>{user?.name?.slice(0, 1)}</Avatar.Fallback>
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium">{user?.name}</span>
            <span className="text-muted-foreground truncate text-xs">
              {user?.email}
            </span>
          </div>
          <Link
            className="text-muted-foreground hover:text-foreground text-sm"
            href="/settings">
            Edit
          </Link>
        </Card.Content>
      </Card>

      <Card className="w-full">
        <Card.Header>
          <Card.Title className="text-sm">Agent this week</Card.Title>
          <Card.Description className="text-xs">
            House-gateway spend only; a bring-your-own-key call is your own
            bill.
          </Card.Description>
        </Card.Header>
        <Card.Content className="flex flex-col gap-3">
          {usage.error ? (
            <p className="text-danger text-sm">{usage.error.message}</p>
          ) : !standing || percent === null ? (
            <p className="text-muted-foreground text-sm">
              No weekly allowance applies to your account.
            </p>
          ) : (
            <>
              <ProgressBar
                color={percent >= 100 ? "danger" : "accent"}
                size="sm"
                value={percent}>
                <Label className="text-muted-foreground text-xs font-normal">
                  {formatUsd(standing.usedMicros / MICROS_PER_USD)} of{" "}
                  {formatUsd((standing.limitMicros ?? 0) / MICROS_PER_USD)}
                </Label>
                <ProgressBar.Output className="text-muted-foreground text-xs font-normal">
                  {percent}%
                </ProgressBar.Output>
                <ProgressBar.Track>
                  <ProgressBar.Fill />
                </ProgressBar.Track>
              </ProgressBar>
              <span className="text-muted-foreground text-xs">
                Resets {formatDateTime(standing.period.end)} (
                {standing.timeZone})
              </span>
            </>
          )}
        </Card.Content>
      </Card>
    </div>
  );
};

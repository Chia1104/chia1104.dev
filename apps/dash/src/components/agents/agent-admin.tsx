"use client";

import { useMemo } from "react";

import { Spinner } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/libs/orpc/client";

import { KindCard } from "./kind-card";
import { TaskCard } from "./task-card";

/**
 * The agent workspace. Every call is a client-side oRPC call behind `adminGuard()`. Cards
 * are keyed on their row's `updatedAt`, so a save remounts the card with the server's view
 * of the override instead of reconciling it against a form in progress.
 */
export const AgentAdmin = () => {
  const kinds = useQuery(orpc.agent.admin.kinds.list.queryOptions());
  const tasks = useQuery(orpc.agent.admin.tasks.list.queryOptions());
  const taskModels = useQuery(orpc.agent.admin.tasks.models.queryOptions());

  const groups = useMemo(() => {
    const byKind = new Map<string | null, NonNullable<typeof tasks.data>>();
    for (const task of tasks.data ?? []) {
      const list = byKind.get(task.kind) ?? [];
      list.push(task);
      byKind.set(task.kind, list);
    }
    return byKind;
  }, [tasks.data]);

  const labelOfKind = (kind: string | null) =>
    kind === null
      ? "Every agent"
      : (kinds.data?.find((k) => k.kind === kind)?.label ?? kind);

  if (kinds.isLoading || tasks.isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="sm" />
      </div>
    );
  }
  const error = kinds.error ?? tasks.error;
  if (error) {
    return <p className="text-danger py-8 text-sm">{error.message}</p>;
  }

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold">Agents</h2>
          <p className="text-muted-foreground text-xs">
            One card per registered agent kind.
          </p>
        </div>
        {kinds.data?.map((kind) => (
          <KindCard key={`${kind.kind}:${kind.updatedAt}`} kind={kind} />
        ))}
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold">Tasks</h2>
          <p className="text-muted-foreground text-xs">
            The one-shot model calls that run beside a session — naming it,
            compacting it, learning from it.
          </p>
        </div>
        {[...groups.entries()].map(([kind, list]) => (
          <div key={kind ?? "shared"} className="flex flex-col gap-3">
            <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {labelOfKind(kind)}
            </h3>
            {list.map((task) => (
              <TaskCard
                key={`${task.id}:${task.updatedAt}`}
                models={taskModels.data}
                task={task}
              />
            ))}
          </div>
        ))}
      </section>
    </div>
  );
};

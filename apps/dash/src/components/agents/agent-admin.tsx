"use client";

import { useMemo } from "react";

import { Spinner, Tabs } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { parseAsString, useQueryState } from "nuqs";

import { AgentLabelsProvider } from "@chia/agent-elements/labels-context";
import agentLabels from "@chia/i18n/agent-elements/en-US.json";

import { orpc } from "@/libs/orpc/client";
import type { RouterOutputs } from "@/libs/orpc/types";

import { KindCard } from "./kind-card";
import { KindSummary } from "./kind-summary";
import { QuotaCard } from "./quota-card";
import { isKindOverridden, isTaskOverridden } from "./shared";
import type { AgentModelInfo, KindAdmin, TaskAdmin } from "./shared";
import { TaskCard } from "./task-card";

type QuotaAdmin = RouterOutputs["agent"]["admin"]["quota"]["get"];

/** The tab for what no single agent owns: the shared tasks and the allowance. */
const SHARED_TAB = "shared";

const TabLabel = ({
  label,
  detail,
  overridden,
}: {
  label: string;
  detail?: string;
  overridden: boolean;
}) => (
  <span className="flex items-center gap-2">
    <span>{label}</span>
    {detail ? (
      <span className="text-muted font-mono text-xs">{detail}</span>
    ) : null}
    {overridden ? (
      <>
        <span aria-hidden className="bg-warning size-1.5 rounded-full" />
        <span className="sr-only">, overridden</span>
      </>
    ) : null}
  </span>
);

const TaskList = ({
  tasks,
  models,
}: {
  tasks: TaskAdmin[];
  models: readonly AgentModelInfo[] | undefined;
}) =>
  tasks.map((task) => (
    <TaskCard
      key={`${task.id}:${task.updatedAt}`}
      models={models}
      task={task}
    />
  ));

const KindPanel = ({
  kind,
  tasks,
  models,
}: {
  kind: KindAdmin;
  tasks: TaskAdmin[];
  models: readonly AgentModelInfo[] | undefined;
}) => (
  <div className="flex flex-col gap-8">
    <header className="flex flex-col gap-4">
      <p className="text-muted max-w-prose text-sm">{kind.description}</p>
      <KindSummary kind={kind} models={models} />
    </header>

    <KindCard key={`${kind.kind}:${kind.updatedAt}`} kind={kind} />

    {tasks.length > 0 ? (
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold">Tasks</h2>
          <p className="text-muted text-xs">
            One-shot model calls only this agent runs.
          </p>
        </div>
        <TaskList models={models} tasks={tasks} />
      </section>
    ) : null}
  </div>
);

const SharedPanel = ({
  tasks,
  models,
  quota,
}: {
  tasks: TaskAdmin[];
  models: readonly AgentModelInfo[] | undefined;
  quota: QuotaAdmin | undefined;
}) => (
  <div className="flex flex-col gap-8">
    <p className="text-muted max-w-prose text-sm">
      What runs beside every agent&apos;s sessions, and how much a visitor may
      spend on the house account.
    </p>

    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Tasks</h2>
        <p className="text-muted text-xs">
          Naming a session, compacting it, keeping the gist of a rewind.
        </p>
      </div>
      <TaskList models={models} tasks={tasks} />
    </section>

    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Usage quota</h2>
        <p className="text-muted text-xs">
          Weekly house spend per signed-in visitor. You are never limited.
        </p>
      </div>
      {quota ? <QuotaCard key={quota.updatedAt} quota={quota} /> : null}
    </section>
  </div>
);

/** Client-side oRPC behind `adminGuard()`. Cards remount on `updatedAt` so a save replaces the form instead of reconciling it. */
export const AgentAdmin = () => {
  const kinds = useQuery(orpc.agent.admin.kinds.list.queryOptions());
  const tasks = useQuery(orpc.agent.admin.tasks.list.queryOptions());
  const taskModels = useQuery(orpc.agent.admin.tasks.models.queryOptions());
  const quota = useQuery(orpc.agent.admin.quota.get.queryOptions());

  const [requested, setTab] = useQueryState(
    "agent",
    parseAsString.withDefault("")
  );

  const tasksByKind = useMemo(() => {
    const byKind = new Map<string | null, TaskAdmin[]>();
    for (const task of tasks.data ?? []) {
      const list = byKind.get(task.kind) ?? [];
      list.push(task);
      byKind.set(task.kind, list);
    }
    return byKind;
  }, [tasks.data]);

  if (
    kinds.isLoading ||
    tasks.isLoading ||
    taskModels.isLoading ||
    quota.isLoading
  ) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="sm" />
      </div>
    );
  }
  const error = kinds.error ?? tasks.error ?? taskModels.error ?? quota.error;
  if (error) {
    return <p className="text-danger py-8 text-sm">{error.message}</p>;
  }

  const kindList = kinds.data ?? [];
  const sharedTasks = tasksByKind.get(null) ?? [];
  // An unknown or absent `?agent=` lands on the first agent, never on an empty panel.
  const selected =
    kindList.some((kind) => kind.kind === requested) || requested === SHARED_TAB
      ? requested
      : (kindList[0]?.kind ?? SHARED_TAB);

  return (
    <AgentLabelsProvider labels={agentLabels}>
      <Tabs
        className="w-full"
        onSelectionChange={(key) => void setTab(String(key))}
        selectedKey={selected}
        variant="secondary">
        <Tabs.ListContainer>
          <Tabs.List aria-label="Agents" className="min-w-0">
            {kindList.map((kind) => (
              <Tabs.Tab key={kind.kind} className="w-auto" id={kind.kind}>
                <TabLabel
                  detail={kind.kind}
                  label={kind.label}
                  overridden={isKindOverridden(kind)}
                />
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
            <Tabs.Tab className="w-auto" id={SHARED_TAB}>
              <TabLabel
                label="Shared"
                overridden={sharedTasks.some(isTaskOverridden)}
              />
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        {/* Panels stay mounted so an edit survives a look at another tab. */}
        {kindList.map((kind) => (
          <Tabs.Panel
            key={kind.kind}
            className="px-0 pt-6 data-inert:hidden"
            id={kind.kind}
            shouldForceMount>
            <KindPanel
              kind={kind}
              models={taskModels.data}
              tasks={tasksByKind.get(kind.kind) ?? []}
            />
          </Tabs.Panel>
        ))}
        <Tabs.Panel
          className="px-0 pt-6 data-inert:hidden"
          id={SHARED_TAB}
          shouldForceMount>
          <SharedPanel
            models={taskModels.data}
            quota={quota.data}
            tasks={sharedTasks}
          />
        </Tabs.Panel>
      </Tabs>
    </AgentLabelsProvider>
  );
};

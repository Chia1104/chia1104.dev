import "server-only";
import { Suspense } from "react";

import { Spinner } from "@heroui/react";

import { AgentAdmin } from "@/components/agents/agent-admin";

export const dynamic = "force-dynamic";

const AgentsPage = () => (
  <section className="flex w-full flex-col gap-6">
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold">Agents</h1>
      <p className="text-muted max-w-prose text-sm">
        What each agent runs as today, and what you changed from the code.
        Agents and their tasks are registered in code; this page only overrides
        them.
      </p>
    </div>
    <Suspense
      fallback={
        <div className="flex justify-center py-12">
          <Spinner size="sm" />
        </div>
      }>
      <AgentAdmin />
    </Suspense>
  </section>
);

export default AgentsPage;

"use client";

import { ErrorBoundary } from "@chia/ui/error-boundary";

import { AgentWorkspace } from "@/components/agent/agent-workspace";

const Page = () => {
  return (
    <ErrorBoundary>
      <AgentWorkspace />
    </ErrorBoundary>
  );
};

export default Page;

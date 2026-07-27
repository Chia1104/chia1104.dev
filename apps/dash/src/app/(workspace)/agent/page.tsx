"use client";

import { Spinner } from "@heroui/react";

import { Role } from "@chia/db/types";
import { ErrorBoundary } from "@chia/ui/error-boundary";

import { AgentWorkspace } from "@/components/agent/agent-workspace";
import AuthGuard from "@/components/commons/auth-guard";

const Page = () => {
  return (
    <ErrorBoundary>
      <AuthGuard
        roles={[Role.Admin, Role.Root]}
        fallback={
          <div className="flex min-h-96 flex-1 items-center justify-center">
            <Spinner aria-label="Verifying administrator access" />
          </div>
        }>
        <AgentWorkspace />
      </AuthGuard>
    </ErrorBoundary>
  );
};

export default Page;

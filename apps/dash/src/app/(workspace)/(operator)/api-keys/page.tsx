import "server-only";
import { Suspense } from "react";

import { Spinner } from "@heroui/react";

import { ApiKeysExplorer } from "@/components/api-keys/api-keys-explorer";

export const dynamic = "force-dynamic";

const ApiKeysPage = () => (
  <article className="container flex flex-col gap-6 py-8">
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold">API keys</h1>
      <p className="text-muted-foreground text-sm">
        Keys for servers and agents that call the service without a session.
        Each one carries the scopes it may use; open one to rename, rescope,
        revoke or delete it.
      </p>
    </div>
    <Suspense
      fallback={
        <div className="flex justify-center py-12">
          <Spinner size="sm" />
        </div>
      }>
      <ApiKeysExplorer />
    </Suspense>
  </article>
);

export default ApiKeysPage;

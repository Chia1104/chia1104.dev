import "server-only";
import { Suspense } from "react";

import { Spinner } from "@heroui/react";

import { UsersExplorer } from "@/components/users/users-explorer";

export const dynamic = "force-dynamic";

const UsersPage = () => (
  <article className="container flex flex-col gap-6 py-8">
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold">Users</h1>
      <p className="text-muted-foreground text-sm">
        Every account and guest, with what they have used. Open one to ban, sign
        out, impersonate or delete it.
      </p>
    </div>
    <Suspense
      fallback={
        <div className="flex justify-center py-12">
          <Spinner size="sm" />
        </div>
      }>
      <UsersExplorer />
    </Suspense>
  </article>
);

export default UsersPage;

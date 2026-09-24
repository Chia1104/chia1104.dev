import "server-only";
import { Suspense } from "react";

import { Spinner } from "@heroui/react";

import { ReportsInbox } from "@/components/reports/reports-inbox";

export const dynamic = "force-dynamic";

const ReportsPage = () => (
  <section className="flex w-full flex-col gap-6">
    <h1 className="text-2xl font-semibold">Reader reports</h1>
    <Suspense
      fallback={
        <div className="flex justify-center py-12">
          <Spinner size="sm" />
        </div>
      }>
      <ReportsInbox />
    </Suspense>
  </section>
);

export default ReportsPage;

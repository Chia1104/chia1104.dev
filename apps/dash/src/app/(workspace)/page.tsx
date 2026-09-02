import "server-only";
import { DashboardOverview } from "@/components/dashboard/overview";

export const dynamic = "force-dynamic";

const OverviewPage = () => (
  <article className="container flex flex-col gap-6 py-8">
    <h1 className="text-2xl font-semibold">Overview</h1>
    <DashboardOverview />
  </article>
);

export default OverviewPage;

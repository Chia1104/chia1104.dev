import "server-only";
import { Overview } from "@/components/dashboard/overview-by-access";

export const dynamic = "force-dynamic";

const OverviewPage = () => (
  <article className="container flex flex-col gap-6 py-8">
    <h1 className="text-2xl font-semibold">Overview</h1>
    <Overview />
  </article>
);

export default OverviewPage;

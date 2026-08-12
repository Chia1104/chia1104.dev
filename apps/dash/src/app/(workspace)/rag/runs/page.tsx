import "server-only";
import { RagRunsTable } from "@/components/rag/rag-runs-table";

export const dynamic = "force-dynamic";

const RagRunsPage = () => (
  <section className="flex w-full flex-col gap-6">
    <h1 className="text-2xl font-semibold">Index runs</h1>
    <RagRunsTable />
  </section>
);

export default RagRunsPage;

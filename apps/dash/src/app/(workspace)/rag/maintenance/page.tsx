import "server-only";
import { RagMaintenance } from "@/components/rag/rag-maintenance";

export const dynamic = "force-dynamic";

const RagMaintenancePage = () => (
  <section className="flex w-full flex-col gap-6">
    <h1 className="text-2xl font-semibold">Maintenance</h1>
    <RagMaintenance />
  </section>
);

export default RagMaintenancePage;

import "server-only";
import { RagOverview } from "@/components/rag/rag-overview";

export const dynamic = "force-dynamic";

const RagPage = () => (
  <section className="flex w-full flex-col gap-6">
    <h1 className="text-2xl font-semibold">RAG</h1>
    <RagOverview />
  </section>
);

export default RagPage;

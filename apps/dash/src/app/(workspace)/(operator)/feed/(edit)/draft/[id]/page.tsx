import "server-only";
import { notFound } from "next/navigation";
import { ViewTransition } from "react";

import * as z from "zod";

import { NumericStringSchema } from "@chia/utils/schema";

import { EditDraft } from "@/containers/feed/edit-feed";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ id: NumericStringSchema });

const Page = async ({ params }: { params: Promise<{ id: string }> }) => {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) {
    notFound();
  }

  return (
    <ViewTransition>
      <section className="page-container min-h-screen py-8">
        <EditDraft draftId={Number(parsed.data.id)} />
      </section>
    </ViewTransition>
  );
};

export default Page;

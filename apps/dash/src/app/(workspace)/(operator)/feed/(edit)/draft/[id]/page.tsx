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
      <section className="flex min-h-screen w-full justify-center">
        <div className="w-full max-w-4xl px-4 py-8 md:px-6 lg:px-8">
          <EditDraft draftId={Number(parsed.data.id)} />
        </div>
      </section>
    </ViewTransition>
  );
};

export default Page;

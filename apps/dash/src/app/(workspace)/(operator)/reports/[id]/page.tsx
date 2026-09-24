import "server-only";
import { notFound } from "next/navigation";

import * as z from "zod";

import { NumericStringSchema } from "@chia/utils/schema";

import { ReportDetail } from "@/components/reports/report-detail";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ id: NumericStringSchema });

const Page = async ({ params }: { params: Promise<{ id: string }> }) => {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) {
    notFound();
  }

  return <ReportDetail id={Number(parsed.data.id)} />;
};

export default Page;

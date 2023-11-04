import { PrismaClient as PrismaClientEdge, Prisma } from "@prisma/client/edge";
import { errorGenerator } from "@chia/utils";
import dayjs from "dayjs";
import { NextRequest, NextResponse } from "next/server";

const prisma = new PrismaClientEdge({
  datasourceUrl: process.env.UMAMI_EDGE_DB_URL,
});

export const runtime = "edge";
/**
 * Tokyo, Japan
 */
export const preferredRegion = ["hnd1"];

export const GET = async (req: NextRequest) => {
  const websiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
  const lastFiveMinutes = dayjs().subtract(5, "minute").toISOString();

  const query = `
    select count(distinct session_id) as current_visitors
    from website_event
    where website_id = '${websiteId}'
    and created_at >= '${lastFiveMinutes}'
  `;
  try {
    const result: [
      {
        current_visitors: bigint;
      },
    ] = await prisma.$queryRaw`${Prisma.raw(query)}`;
    return NextResponse.json({
      currentVisitors: Number(result[0].current_visitors),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(errorGenerator(500), {
      status: 500,
    });
  }
};

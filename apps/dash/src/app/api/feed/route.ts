import { prisma } from "db";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/server/auth/auth-options";
import { errorConfig } from "@/config/network.config";

type Query = {
  skip?: number;
  take?: number;
};

export const GET = async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const { skip, take } = searchParams as unknown as Query;
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json(
      {
        error:
          "You must be signed in to view the protected content on this page.",
        code: errorConfig[401],
      },
      { status: 401 }
    );
  }

  const feeds = await prisma.post.findMany({
    skip: skip ? Number(skip) : undefined,
    take: take ? Number(take) : 10,
    orderBy: { createdAt: "desc" },
    where: {
      published: true,
      user: {
        id: session.user.id,
      },
    },
  });

  return NextResponse.json(feeds, { status: 200 });
};

import { type NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "./utils";
import { errorGenerator } from "@chia/utils";

export const runtime = "edge";

export const POST = async (req: NextRequest) => {
  try {
    const accessToken = await getAccessToken();
    return NextResponse.json({ success: !!accessToken });
  } catch (error) {
    return NextResponse.json(errorGenerator(500), {
      status: 500,
    });
  }
};

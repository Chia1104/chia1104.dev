import { type NextRequest, NextResponse } from "next/server";
import { getNowPlaying } from "../utils";
import { errorGenerator } from "@chia/utils";
import { HTTPError } from "ky";

export const runtime = "edge";

export const GET = async (req: NextRequest) => {
  try {
    const data = await getNowPlaying({
      cache: "no-store",
    });
    return NextResponse.json(data);
  } catch (error: any) {
    console.error(error);
    if (error instanceof HTTPError || !!error.response) {
      const { response } = error;
      return NextResponse.json(errorGenerator(response.status), {
        status: response.status,
      });
    }
    return NextResponse.json(errorGenerator(500), {
      status: 500,
    });
  }
};

import { NextResponse } from "next/server";
import { getNowPlaying } from "@chia/api/spotify";
import { errorGenerator } from "@chia/utils";
import { HTTPError } from "ky";
import { unstable_noStore as noStore } from "next/cache";

export const runtime = "edge";

export const GET = async () => {
  noStore();
  try {
    const data = await getNowPlaying({
      cache: "no-store",
    });
    return NextResponse.json(data);
  } catch (error: any) {
    if (error instanceof HTTPError || !!error.response) {
      const { response } = error;
      return NextResponse.json(errorGenerator(response.status as number), {
        status: response.status,
      });
    }
    return NextResponse.json(errorGenerator(500), {
      status: 500,
    });
  }
};

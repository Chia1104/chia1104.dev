import { type NextRequest, NextResponse } from "next/server";
import { getPlayList } from "../utils";
import { errorGenerator } from "@chia/utils";
import { HTTPError } from "ky";

export const runtime = "edge";

export const GET = async (req: NextRequest) => {
  try {
    const data = await getPlayList();
    return NextResponse.json(data);
  } catch (error) {
    console.error(error);
    if (error instanceof HTTPError) {
      const { response } = error;
      switch (response.status) {
        case 401:
          return NextResponse.json(errorGenerator(401), {
            status: 401,
          });
        case 403:
          return NextResponse.json(errorGenerator(403), {
            status: 403,
          });
        case 429:
          return NextResponse.json(errorGenerator(429), {
            status: 429,
          });
        default:
          return NextResponse.json(errorGenerator(500), {
            status: 500,
          });
      }
    }
    return NextResponse.json(errorGenerator(500), {
      status: 500,
    });
  }
};

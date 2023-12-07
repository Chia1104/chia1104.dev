import { NextResponse } from "next/server";
import { getPlayList } from "@chia/api/spotify";
import { errorGenerator } from "@chia/utils";
import { HTTPError } from "ky";

export const runtime = "edge";

export const GET = async () => {
  try {
    const data = await getPlayList();
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

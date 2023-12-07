import { NextResponse } from "next/server";
import { getSpotifyAccessToken } from "@chia/api/spotify";
import { errorGenerator } from "@chia/utils";

export const runtime = "edge";

export const POST = async () => {
  try {
    const accessToken = await getSpotifyAccessToken();
    return NextResponse.json({ success: !!accessToken });
  } catch (error) {
    return NextResponse.json(errorGenerator(500), {
      status: 500,
    });
  }
};

import { env } from "@/env.mjs";
import type { ApiRespond, Youtube } from "@/shared/types";

export const getAllVideos = async (
  maxResult = 10
): Promise<ApiRespond<Youtube>> => {
  const URL = `${env.GOOGLE_API}/youtube/v3/playlistItems?part=snippet&playlistId=${env.YOUTUBE_LIST_ID}&key=${env.GOOGLE_API_KEY}&maxResults=${maxResult}`;

  try {
    const res = await fetch(URL, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      next: {
        revalidate: 60,
        tags: ["youtube-videos"],
      },
    });
    const data: Youtube = (await res.json()) as Youtube;

    return { status: res.status, data };
  } catch (err: any) {
    throw err;
  }
};

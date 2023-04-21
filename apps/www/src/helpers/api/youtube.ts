import {
  GOOGLE_API,
  GOOGLE_API_KEY,
  YOUTUBE_LIST_ID,
} from "@/shared/constants/index.ts";
import type { ApiRespond, Youtube } from "@/shared/types/index.ts";

export const getAllVideos = async (
  maxResult = 10
): Promise<ApiRespond<Youtube>> => {
  const URL = `${GOOGLE_API}youtube/v3/playlistItems?part=snippet&playlistId=${YOUTUBE_LIST_ID}&key=${GOOGLE_API_KEY}&maxResults=${maxResult}`;

  try {
    const res = await fetch(URL, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      next: {
        revalidate: 60,
      },
    });
    const data: Youtube = (await res.json()) as Youtube;

    return { status: res.status, data };
  } catch (err: any) {
    throw err;
  }
};

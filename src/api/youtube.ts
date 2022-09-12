import {
  GOOGLE_API,
  GOOGLE_API_KEY,
  YOUTUBE_LIST_ID,
} from "@chia/shared/constants";
import type { ApiRespond, Youtube } from "@chia/shared/types";

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
    });
    const data: Youtube = await res.json();

    return { status: res.status, data };
  } catch (err: any) {
    throw err;
  }
};

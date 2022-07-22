import { GOOGLE_API, YOUTUBE_ID, YOUTUBE_LIST_ID } from "@chia/utils/constants";

const KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;

export const getAllVideos = async (
  maxResult?: number
): Promise<{ data: object; status: number }> => {
  if (!maxResult) maxResult = 10;
  const URL = `${GOOGLE_API}youtube/v3/playlistItems?part=snippet&playlistId=${YOUTUBE_LIST_ID}&key=${KEY}&maxResults=${maxResult}`;

  try {
    const res = await fetch(URL, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });
    const data: object = await res.json();

    return { status: res.status, data: data };
  } catch (err: any) {
    throw err;
  }
};

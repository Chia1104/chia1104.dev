import { GOOGLE_API, YOUTUBE_ID } from "@chia/utils/constants";

const KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;

export const getAllVideos = async (maxResult?: number): Promise<{data: object, status: number}> => {
    if (!maxResult) maxResult = 10;

    try {
        const res = await fetch(`${GOOGLE_API}youtube/v3/videos?id=${YOUTUBE_ID}&key=${KEY}&maxResults=${maxResult}`, {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
        });
        const data: object = await res.json();

        return { status: res.status, data: data }
    } catch (err: any) {
        throw err;
    }
}

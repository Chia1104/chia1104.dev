import {
  SPOTIFY_NOW_PLAYING_URL,
  SPOTIFY_TOKEN_URL,
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
} from "@chia/shared/constants";

const basic = Buffer.from(
  `${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`
).toString("base64");

const getAccessToken = async () => {
  const URL = `${SPOTIFY_TOKEN_URL}?grant_type=client_credentials`;

  try {
    const res = await fetch(URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basic}`,
      },
    });
    const data: any = (await res.json()) as any;

    return data;
  } catch (err: any) {
    throw err;
  }
};

export const getNowPlaying = async () => {
  const URL = `${SPOTIFY_NOW_PLAYING_URL}`;

  try {
    const TOKEN = await getAccessToken();
    const res = await fetch(URL, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
      },
    });
    const data: any = (await res.json()) as any;

    return data;
  } catch (err: any) {
    throw err;
  }
};

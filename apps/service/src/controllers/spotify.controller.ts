import { Hono } from "hono";

import { getPlayList, getNowPlaying } from "@chia/api/spotify";
import { errorGenerator } from "@chia/utils";

const api = new Hono<HonoContext>();

api.get("/playlist/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const data = await getPlayList({
      playlistId: id === "default" ? undefined : id,
    });
    return c.json(data);
  } catch (err) {
    console.error(err);
    c.get("sentry").captureException(err);
    return c.json(errorGenerator(500), 500);
  }
});

api.get("/playing", async (c) => {
  try {
    const data = await getNowPlaying();
    return c.json(data);
  } catch (err) {
    console.error(err);
    c.get("sentry").captureException(err);
    return c.json(errorGenerator(500), 500);
  }
});

export default api;

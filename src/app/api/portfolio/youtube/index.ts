import { getAllVideos } from "@chia/api/youtube";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const _data = await getAllVideos(4);
    const { status } = _data;
    res.status(status).json(_data);
  } catch (error) {
    console.error(error);
    res.status(500).json(error);
  }
}

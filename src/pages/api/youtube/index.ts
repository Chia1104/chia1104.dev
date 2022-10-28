import { getAllVideos } from "@chia/api/youtube";
import type { NextApiRequest, NextApiResponse } from "next";
import type { Youtube } from "@chia/shared/types";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Youtube>
) {
  try {
    const _data = await getAllVideos(4);
    const { status, data } = _data;
    res.status(status).json(data);
  } catch (error: any) {
    console.error(error);
    res.status(500).json(error);
  }
}

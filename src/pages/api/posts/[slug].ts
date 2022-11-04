import type { NextApiRequest, NextApiResponse } from "next";
import { getPost } from "@chia/helpers/mdx/services";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { slug } = req.query;
  const post = await getPost(slug as string);
  res.status(200).json(post);
}

import type { Feed } from "@chia/db/schema";
import { get, getServiceEndPoint } from "@chia/utils";

export const searchFeeds = async (query: string) => {
  const response = await get<(Feed & { similarity: number })[]>(
    `${getServiceEndPoint()}/feeds/search`,
    {
      keyword: query,
    },
    {
      credentials: "include",
    }
  );
  return response;
};

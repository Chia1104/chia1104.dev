import type { Feed } from "@chia/db/schema";
import { getServiceEndPoint } from "@chia/utils";
import { post } from "@chia/utils";

export const searchFeeds = async (query: string) => {
  const response = await post<(Feed & { similarity: number })[]>(
    `${getServiceEndPoint()}/feeds/search`,
    {
      keyword: query,
    }
  );
  return response;
};

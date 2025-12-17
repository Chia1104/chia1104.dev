import type { Feed } from "@chia/db/schema";
import { getServiceEndPoint } from "@chia/utils/config";
import { get } from "@chia/utils/request";

export const searchFeeds = async (query: string) => {
  const response = await get<(Feed & { similarity: number })[]>(
    `${getServiceEndPoint()}/feeds/search`,
    {
      keyword: query,
      /**
       * TODO: Fix dimensions size conflict, Ollama Embedding model dimensions size is 384, Our database is 1536
       */
      // model: "all-minilm",
      model: "text-embedding-ada-002",
    },
    {
      credentials: "include",
    }
  );
  return response;
};

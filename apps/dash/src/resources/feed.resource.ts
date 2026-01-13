import { getServiceEndPoint } from "@chia/utils/config";
import { get } from "@chia/utils/request";

// Search result type from embedding search
export interface FeedSearchResult {
  id: number;
  userId: string;
  type: string;
  slug: string;
  contentType: string;
  published: boolean;
  defaultLocale: string;
  mainImage: string | null;
  createdAt: Date;
  updatedAt: Date;
  feedTranslationId: number;
  locale: string;
  title: string;
  excerpt: string | null;
  description: string | null;
  summary: string | null;
  readTime: number | null;
  similarity: number;
}

export const searchFeeds = async (query: string, locale?: string) => {
  const response = await get<FeedSearchResult[]>(
    `${getServiceEndPoint()}/feeds/search`,
    {
      keyword: query,
      locale,
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

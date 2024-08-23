import { HTTPError } from "ky";

import { getDB, count, schema, eq } from "@chia/db";
import { serviceRequest, getAdminId } from "@chia/utils";

export const getTotal = async () => {
  try {
    return (
      await serviceRequest({
        next: { revalidate: 10 },
        // isInternal: true,
      })
        .get<{ total: number }>("admin/public/feeds:meta")
        .json()
    ).total;
  } catch (error) {
    if (error instanceof HTTPError) {
      return (
        await getDB()
          .select({ count: count(schema.feeds.published) })
          .from(schema.feeds)
          .where(eq(schema.feeds.userId, getAdminId()))
      )[0].count;
    }
    throw error;
  }
};

// Google's limit is 50,000 URLs per sitemap
export const URLS_PER_SITEMAP = 1000;

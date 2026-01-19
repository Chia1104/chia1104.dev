import { readingTime } from "reading-time-estimator";

import { connectDatabase } from "@chia/db/client";
import { upsertFeedTranslation } from "@chia/db/repos/feeds";
import type { Locale } from "@chia/db/types";

export const estimateReadingTimeStep = async (
  feedID: number,
  locale: Locale,
  content: string
) => {
  "use step";

  const db = await connectDatabase();
  const readingTimeResult = readingTime(content);

  console.log("Reading time result", readingTimeResult);

  return await upsertFeedTranslation(db, {
    feedId: feedID,
    locale: locale,
    readTime: readingTimeResult.minutes,
  });
};

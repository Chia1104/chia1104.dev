import { readingTime } from "reading-time-estimator";

import { connectDatabase } from "@chia/db/client";
import { upsertFeedTranslation } from "@chia/db/repos/feeds";
import { Locale } from "@chia/db/types";

/** The estimator counts CJK by character; without the language it applies English wpm. */
const estimatorLanguage = (locale: Locale) =>
  locale === Locale.zhTW ? ("zh-tw" as const) : ("en" as const);

export const estimateReadingTimeStep = async (
  feedID: number,
  locale: Locale,
  content: string
) => {
  "use step";

  const db = await connectDatabase(undefined, { withCache: false });
  const readingTimeResult = readingTime(content, {
    language: estimatorLanguage(locale),
  });

  console.log("Reading time result", readingTimeResult);

  return await upsertFeedTranslation(db, {
    feedId: feedID,
    locale: locale,
    readTime: readingTimeResult.minutes,
  });
};

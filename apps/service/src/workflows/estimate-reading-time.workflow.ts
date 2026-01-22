import * as z from "zod";

import { Locale } from "@chia/db/types";

import { estimateReadingTimeStep } from "../steps/estimate-reading-time.step";

export const requestSchema = z.object({
  feedID: z.number(),
  locale: z.enum(Locale).optional().default(Locale.zhTW),
  content: z.string(),
});

type Request = z.input<typeof requestSchema>;

export const estimateReadingTimeWorkflow = async (request: Request) => {
  "use workflow";

  const parsedRequest = requestSchema.parse(request);

  await estimateReadingTimeStep(
    parsedRequest.feedID,
    parsedRequest.locale,
    parsedRequest.content
  );

  return {
    success: true,
  };
};

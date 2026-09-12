import * as z from "zod";

import { Locale } from "@chia/db/types";
import { feedDraftSchema } from "@chia/services/feeds/feeds.contract";

/** The editable draft fields plus the locale currently shown by the form. */
export const draftFormSchema = z.compile(
  feedDraftSchema
    .pick({
      slug: true,
      type: true,
      defaultLocale: true,
      mainImage: true,
      translations: true,
    })
    .extend({ activeLocale: z.enum(Locale) })
);

export type DraftFormValues = z.infer<typeof draftFormSchema>;

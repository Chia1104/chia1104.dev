import * as z from "zod";

import { feedsContracts } from "@chia/api/orpc/contracts";
import { Locale } from "@chia/db/types";

/** The editable draft fields plus the locale currently shown by the form. */
export const draftFormSchema = z.compile(
  feedsContracts.feedDraftSchema
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

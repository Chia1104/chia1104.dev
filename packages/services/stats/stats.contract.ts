import { oc } from "@orpc/contract";
import * as z from "zod";

import { locale } from "@chia/db/schema/enums";

export const pageViewSchema = z.object({
  /** The page's path without the locale prefix. */
  path: z.string().startsWith("/").max(512),
  locale: z.enum(locale.enumValues),
  /** `document.referrer` of the first page in a visit; only an external host is kept. */
  referrer: z.url().max(2048).optional(),
});

/** A page a reader's browser opened. Public, so an anonymous reader can report one. */
export const viewContract = oc
  .errors({
    UNAUTHORIZED: {},
    FORBIDDEN: {},
    TOO_MANY_REQUESTS: {},
  })
  .input(pageViewSchema)
  .output(z.void());

export const statsContract = {
  view: viewContract,
};

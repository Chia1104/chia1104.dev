import { z } from "zod";

import {
  getFeedsWithMetaByAdminId,
  getFeedBySlug,
  getMeta,
} from "../../../services/feeds";
import { getFeedsWithMetaSchema } from "../../../services/validators";
import { external_createTRPCRouter, external_procedure } from "../../trpc";

export const feedsRouter = external_createTRPCRouter({
  getFeedsWithMetaByAdminId: external_procedure
    .input(getFeedsWithMetaSchema)
    .query((opts) =>
      getFeedsWithMetaByAdminId(opts.ctx.internal_requestSecret, opts.input)
    ),

  getFeedBySlug: external_procedure
    .input(z.object({ slug: z.string() }))
    .query((opts) =>
      getFeedBySlug(opts.ctx.internal_requestSecret, opts.input)
    ),

  getMeta: external_procedure.query((opts) =>
    getMeta(opts.ctx.internal_requestSecret, opts.input)
  ),
});

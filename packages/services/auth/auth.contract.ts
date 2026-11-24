import { oc } from "@orpc/contract";
import * as z from "zod";

import { DashboardAccess } from "@chia/auth/access";
import { CallerTier } from "@chia/auth/tier";

const callerTierSchema = z.literal(Object.values(CallerTier));

export const sessionSchema = z.object({
  user: z.object({
    id: z.string(),
    name: z.string(),
    /** `null` for a guest. */
    email: z.string().nullable(),
    image: z.string().nullable(),
    isAnonymous: z.boolean(),
  }),
  /** ISO instant the cookie stops working. */
  expiresAt: z.string(),
  /** What the frontends may render; guards never read it. */
  access: z.object({
    tier: callerTierSchema,
    dashboard: z.enum(DashboardAccess).nullable(),
    agent: z.record(z.string(), callerTierSchema),
  }),
});

export type Session = z.infer<typeof sessionSchema>;

/** The caller's session, or `null` without one. */
export const sessionContract = oc.output(sessionSchema.nullable());

export const authContract = {
  session: sessionContract,
};

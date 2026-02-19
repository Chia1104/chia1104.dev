import { createInsertSchema } from "drizzle-orm/zod";
import * as z from "zod";

import { user } from "../../schemas";

export const insertUserSchema = z.object({
  ...createInsertSchema(user).omit({
    id: true,
    emailVerified: true,
  }).shape,
  id: z.uuid(),
});

export type InsertUserDTO = z.infer<typeof insertUserSchema>;

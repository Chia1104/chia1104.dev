import { createInsertSchema } from "drizzle-zod";
import * as z from "zod";

import { users } from "../../schema";

export const insertUserSchema = z.object({
  ...createInsertSchema(users).omit({
    id: true,
    emailVerified: true,
  }).shape,
  id: z.uuid(),
});

export type InsertUserDTO = z.infer<typeof insertUserSchema>;

import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { users } from "../../schema";

export const insertUserSchema = createInsertSchema(users)
  .omit({
    id: true,
    emailVerified: true,
  })
  .merge(
    z.object({
      id: z.string().uuid(),
    })
  );

export type InsertUserDTO = z.infer<typeof insertUserSchema>;

import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { project } from "../../schema";

const internal_dateSchema = z.object({
  createdAt: z.union([z.string(), z.number()]).optional(),
  deletedAt: z.union([z.string(), z.number()]).optional(),
});

export const insertProjectSchema = createInsertSchema(project)
  .omit({
    createdAt: true,
    deletedAt: true,
  })
  .merge(internal_dateSchema);

export type InsertProjectDTO = z.infer<typeof insertProjectSchema>;

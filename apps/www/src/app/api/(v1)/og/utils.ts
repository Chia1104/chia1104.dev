import { z } from "zod";

export const ogSchema = (verifyToken: string) =>
  z.object({
    title: z.string().optional().nullable(),
    excerpt: z.string().optional().nullable(),
    subtitle: z.string().optional().nullable(),
    token: z
      .string()
      .optional()
      .nullable()
      .refine((v) => v === verifyToken, {
        message: "Invalid token",
      }),
  });

export type OgDTO = z.infer<ReturnType<typeof ogSchema>>;

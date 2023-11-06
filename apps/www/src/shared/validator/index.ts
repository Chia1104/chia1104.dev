import z from "zod";

export const emailSchema = z.string().email();

export const contactSchema = z.strictObject({
  email: z.string().email(),
  title: z.string().min(5, "Title must be at least 5 characters long"),
  message: z.string().min(5, "Message must be at least 5 characters long"),
  reCaptchToken: z.string().min(1, "reCAPTCHA token is required"),
});

export type Contact = z.infer<typeof contactSchema>;

export type Email = z.infer<typeof emailSchema>;

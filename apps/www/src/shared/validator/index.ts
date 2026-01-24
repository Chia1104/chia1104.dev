import z from "zod";

export const emailSchema = z.email();

export const contactSchema = z.strictObject({
  email: emailSchema,
  title: z.string().min(4, "Title must be at least 4 characters long"),
  message: z.string().min(5, "Message must be at least 5 characters long"),
  captchaToken: z.string().min(1, "reCAPTCHA token is required"),
});

export type Contact = z.infer<typeof contactSchema>;

export type Email = `${string}@${string}.${string}`;

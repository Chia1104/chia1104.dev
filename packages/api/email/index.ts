import meta from "@chia/meta";
import { CONTACT_EMAIL } from "@chia/utils/config";

import { env } from "./env";

export interface ContactEmail {
  email: string;
  title: string;
  message: string;
  /** Recorded in the email body so abuse can be traced. */
  ip: string;
}

export class EmailDeliveryError extends Error {
  constructor(cause?: unknown) {
    super("Failed to deliver the contact email");
    this.name = "EmailDeliveryError";
    this.cause = cause;
  }
}

/**
 * Sends the contact-form email.
 *
 * `resend` and the React template are imported lazily so that merely importing this
 * module — which the oRPC router does — does not pull them into the bundle.
 */
export const sendContactEmail = async (input: ContactEmail): Promise<void> => {
  const apiKey = env.RESEND_API_KEY;

  if (!apiKey) {
    throw new EmailDeliveryError("RESEND_API_KEY is not configured");
  }

  const [{ Resend }, { default: EmailTemplate }] = await Promise.all([
    import("resend"),
    import("@chia/ui/features/EmailTemplate"),
  ]);

  let result: Awaited<
    ReturnType<InstanceType<typeof Resend>["emails"]["send"]>
  >;

  try {
    result = await new Resend(apiKey).emails.send({
      from: CONTACT_EMAIL,
      to: meta.email,
      subject: input.title,
      text: input.message,
      react: EmailTemplate({
        title: input.title,
        message: input.message,
        email: input.email,
        ip: input.ip,
      }),
    });
  } catch (error) {
    throw new EmailDeliveryError(error);
  }

  if (result.error) {
    throw new EmailDeliveryError(result.error);
  }
};

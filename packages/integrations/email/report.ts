import meta from "@chia/meta";
import { CONTACT_EMAIL } from "@chia/utils/config";

import { env } from "./env";
import { EmailDeliveryError } from "./error";

export interface ReportEmail {
  subject: string;
  /** Plain text: the body quotes a reader's words, which must not render as markup. */
  text: string;
}

/** Notifies the operator of a reader report. Text only, so nothing a reader wrote renders. */
export const sendReportEmail = async (input: ReportEmail): Promise<void> => {
  const apiKey = env.RESEND_API_KEY;

  if (!apiKey) {
    throw new EmailDeliveryError("RESEND_API_KEY is not configured");
  }

  const { Resend } = await import("resend");

  let result: Awaited<
    ReturnType<InstanceType<typeof Resend>["emails"]["send"]>
  >;

  try {
    result = await new Resend(apiKey).emails.send({
      from: CONTACT_EMAIL,
      to: meta.email,
      subject: input.subject,
      text: input.text,
    });
  } catch (error) {
    throw new EmailDeliveryError(error);
  }

  if (result.error) {
    throw new EmailDeliveryError(result.error);
  }
};

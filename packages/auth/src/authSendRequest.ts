import type { Theme } from "@auth/core/types";
import { renderAsync } from "@react-email/render";
import type { EmailConfig } from "next-auth/providers";

import AuthEmailTemplate from "@chia/ui/features/AuthEmailTemplate";

export async function sendVerificationRequest(params: {
  identifier: string;
  provider: EmailConfig;
  url: string;
  theme: Theme;
  expires: Date;
  token: string;
  request: Request;
}) {
  const { identifier: to, provider, url } = params;
  const { host } = new URL(url);
  const html = await renderAsync(
    AuthEmailTemplate({
      url,
      host,
    })
  );
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: provider.from,
      to,
      subject: `Sign in to ${host}`,
      html,
      text: text({ url, host }),
    }),
  });

  if (!res.ok)
    throw new Error("Resend error: " + JSON.stringify(await res.json()));
}

// Email Text body (fallback for email clients that don't render HTML, e.g. feature phones)
function text({ url, host }: { url: string; host: string }) {
  return `Sign in to ${host}\n${url}\n\n`;
}

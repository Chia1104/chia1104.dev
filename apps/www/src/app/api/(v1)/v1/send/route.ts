import { Chia } from "@/shared/meta/chia";
import { NextResponse, NextRequest } from "next/server";
import z from "zod";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { type Props } from "./email-template";
import { setSearchParams, handleZodError } from "@chia/utils";
import { Resend } from "resend";
import { errorGenerator } from "@chia/utils";
import { env } from "@/env.mjs";
import { contactSchema, type Contact } from "@/shared/validator";

export const runtime = "edge";

const resend = new Resend(env.RESEND_API_KEY);

const redis = new Redis({
  url: env.REDIS_URL,
  token: env.UPSTASH_TOKEN,
});

const ratelimit = new Ratelimit({
  redis,
  analytics: true,
  limiter: Ratelimit.slidingWindow(2, "5s"),
});

type ReCapthcaResponse = {
  success: boolean;
  challenge_ts: string;
  hostname: string;
  "error-codes": string[];
};

function getIP(req: NextRequest) {
  let ip = req.ip ?? req.headers.get("x-real-ip");
  const forwardedFor = req.headers.get("x-forwarded-for");

  if (!ip && forwardedFor) {
    ip = forwardedFor.split(",").at(0) ?? "";
  }

  return ip;
}

export async function POST(request: NextRequest) {
  try {
    const id = getIP(request) ?? "anonymous";
    const limit = await ratelimit.limit(id ?? "anonymous");

    if (!limit.success) {
      return NextResponse.json(errorGenerator(429), { status: 429 });
    }

    const data = (await request.json()) as Contact;

    const { isError, issues } = handleZodError({
      schema: contactSchema,
      data,
    });

    if (isError) {
      return NextResponse.json(
        errorGenerator(
          400,
          issues?.map((issue) => {
            return {
              field: issue.path.join("."),
              message: issue.message,
            };
          })
        ),
        { status: 400 }
      );
    }

    const siteverify = await fetch(
      `https://www.google.com/recaptcha/api/siteverify?${setSearchParams({
        secret: env.RE_CAPTCHA_KEY,
        response: data.reCaptchToken,
        remoteip: id,
      })}`,
      {
        method: "POST",
      }
    );
    const siteverifyJson = (await siteverify.json()) as ReCapthcaResponse;
    if (!siteverifyJson.success) {
      return NextResponse.json(
        errorGenerator(400, [
          {
            field: "reCaptchToken",
            message: "reCAPTCHA token is invalid",
          },
        ]),
        { status: 400 }
      );
    }
    const result = await resend.emails.send({
      from: "contact@chia1104.dev",
      to: Chia.email,
      subject: data.title ?? "Untitled",
      text: data.message ?? "No message",
      html: htmlSource({
        title: data.title ?? "Untitled",
        message: data.message ?? "No message",
        email: data.email ?? "Anonymous",
        ip: id,
      }),
      // react: EmailTemplate({
      //   title: data.title ?? "Untitled",
      //   message: data.message ?? "No message",
      //   email: data.email ?? "Anonymous",
      //   ip: id,
      // }),
    });
    if (result.error) {
      console.error(result.error.message);
      return NextResponse.json(
        errorGenerator(500, [
          {
            field: "email",
            message: "Failed to send email",
          },
        ]),
        {
          status: 500,
        }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json(errorGenerator(500), {
      status: 500,
    });
  }
}

const htmlSource = ({
  email,
  title = "Untitled",
  message = "No message",
  ip = "Anonymous",
}: Props) => `<!DOCTYPE html
PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html lang="en">

<head data-id="__react-email-head">
<link rel="preload" as="image"
    href="https://firebasestorage.googleapis.com/v0/b/chia1104.appspot.com/o/images%2Fme%2Fcontact.PNG?alt=media" />
<link rel="preload" as="image"
    href="https://firebasestorage.googleapis.com/v0/b/chia1104.appspot.com/o/images%2Fme%2Fcontact.PNG?alt=media" />
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
</head>
<div id="__react-email-preview" style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0">
You have received a message from ${email}<div>
</div>
</div>

<body data-id="__react-email-body"
style="margin-left:auto;margin-right:auto;margin-top:auto;margin-bottom:auto;background-color:rgb(0,0,0);padding:2.5rem;font-family:ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial, Noto Sans, sans-serif, Apple Color Emoji, Segoe UI Emoji, Segoe UI Symbol, Noto Color Emoji;color:rgb(255,255,255)">
<table align="center" width="100%" data-id="react-email-section"
    style="background-image:radial-gradient(#535353 0.5px, transparent 0);position:fixed;left:0px;top:0px;z-index:-10;display:block;height:100%;width:100%;background-size:11px 11px"
    border="0" cellPadding="0" cellSpacing="0" role="presentation">
    <tbody>
        <tr>
            <td></td>
        </tr>
    </tbody>
</table>
<table align="center" width="100%" data-id="__react-email-container" role="presentation" cellSpacing="0"
    cellPadding="0" border="0"
    style="max-width:37.5em;background-color:rgb(0,0,0,0.3);border-color:rgb(248,28,229);margin-left:auto;margin-right:auto;margin-top:40px;margin-bottom:40px;width:465px;border-radius:0.25rem;border-width:1px;border-style:solid;padding:20px;color:rgb(255,255,255);backdrop-filter:blur(12px)">
    <tbody>
        <tr style="width:100%">
            <td>
                <table align="center" width="100%" data-id="react-email-section" border="0" cellPadding="0"
                    cellSpacing="0" role="presentation" style="margin-top:32px">
                    <tbody>
                        <tr>
                            <td><img data-id="react-email-img" alt="Contact me"
                                    src="https://firebasestorage.googleapis.com/v0/b/chia1104.appspot.com/o/images%2Fme%2Fcontact.PNG?alt=media"
                                    width="100" height="100"
                                    style="display:block;outline:none;border:none;text-decoration:none;margin-left:auto;margin-right:auto;margin-top:0px;margin-bottom:0px" />
                            </td>
                        </tr>
                    </tbody>
                </table>
                <h1 data-id="react-email-heading"
                    style="margin-left:0px;margin-right:0px;margin-top:30px;margin-bottom:30px;padding:0px;text-align:center;font-size:24px;font-weight:400">
                    <strong>${title}</strong>
                </h1>
                <p data-id="react-email-text" style="font-size:14px;line-height:24px;margin:16px 0">From: <a
                        href="mailto:${email}" data-id="react-email-link" target="_blank"
                        style="color:rgb(121,255,225);text-decoration:none;text-decoration-line:none">${email}</a>
                </p>
                <p data-id="react-email-text" style="font-size:14px;line-height:24px;margin:16px 0">${message}</p>
                <table align="center" width="100%" data-id="react-email-section" border="0" cellPadding="0"
                    cellSpacing="0" role="presentation"
                    style="margin-bottom:32px;margin-top:32px;text-align:center">
                    <tbody>
                        <tr>
                            <td><a href="mailto:${email}" data-id="react-email-button" target="_blank"
                                    style="line-height:100%;text-decoration:none;display:inline-block;max-width:100%;padding:12px 20px;background-color:rgb(242,227,7);border-radius:0.25rem;text-align:center;font-size:12px;font-weight:600;color:rgb(102,102,102);text-decoration-line:none"><span></span><span
                                        style="max-width:100%;display:inline-block;line-height:120%;mso-padding-alt:0px;mso-text-raise:9px">Reply</span><span></span></a>
                            </td>
                        </tr>
                    </tbody>
                </table>
                <hr data-id="react-email-hr"
                    style="width:100%;border:none;border-top:1px solid #eaeaea;margin-left:0px;margin-right:0px;margin-top:26px;margin-bottom:26px;border-width:1px;border-style:solid;border-color:rgb(234,234,234)" />
                <p data-id="react-email-text"
                    style="font-size:12px;line-height:24px;margin:16px 0;color:rgb(102,102,102)">The message was
                    sent from IP address ${ip}</p>
            </td>
        </tr>
    </tbody>
</table>
</body>

</html>`;

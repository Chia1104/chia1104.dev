import "client-only";
import type { InferRequestType } from "hono";

import { X_CAPTCHA_RESPONSE } from "@chia/api/captcha";

import { client } from "@/libs/service/client";
import { HonoRPCError } from "@/libs/service/error";

type EmailSendRequest = InferRequestType<typeof client.api.v1.email.send.$post>;

export const sendEmail = async (
  data: EmailSendRequest["json"] & {
    captchaToken: string;
  }
) => {
  try {
    const res = await client.api.v1.email.send.$post(
      {
        json: {
          title: data.title,
          message: data.message,
          email: data.email,
        },
      },
      {
        headers: {
          [X_CAPTCHA_RESPONSE]: data.captchaToken,
        },
      }
    );
    if (!res.ok) {
      throw new HonoRPCError(res.statusText, res.status, res.statusText);
    }
    return res.json();
  } catch (error) {
    if (error instanceof HonoRPCError) {
      throw error;
    }
    throw new HonoRPCError("unknown error", 500, "unknown error");
  }
};

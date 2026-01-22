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
      const error = await res.json();
      if (!error) {
        throw new HonoRPCError("unknown error", res.status, "unknown error");
      }
      throw new HonoRPCError(
        error.code,
        res.status,
        error.errors?.[0]?.message ?? "unknown error"
      );
    }
    return res.json();
  } catch (error) {
    if (error instanceof HonoRPCError) {
      throw error;
    }
    throw new HonoRPCError("unknown error", 500, "unknown error");
  }
};

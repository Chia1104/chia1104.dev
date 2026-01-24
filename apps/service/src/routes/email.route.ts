import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { timeout } from "hono/timeout";
import { Resend } from "resend";
import * as z from "zod";

import meta from "@chia/meta";
import EmailTemplate from "@chia/ui/features/EmailTemplate";
import { CONTACT_EMAIL } from "@chia/utils/config";
import { tryCatch } from "@chia/utils/error-helper";
import { errorGenerator } from "@chia/utils/server";

import { env } from "../env";
import { siteverify } from "../guards/captcha.guard";
import { rateLimiterGuard } from "../guards/rate-limiter.guard";
import { errorResponse } from "../utils/error.util";

const api = new Hono<HonoContext>()
  .use(timeout(env.TIMEOUT_MS))
  .use(
    rateLimiterGuard({
      prefix: "rate-limiter:email",
    })
  )
  .use("/send", siteverify)
  .post(
    "/send",
    zValidator(
      "json",
      z.strictObject({
        email: z.email(),
        title: z.string().min(4, "Title must be at least 4 characters long"),
        message: z
          .string()
          .min(5, "Message must be at least 5 characters long"),
      }),
      (result, c) => {
        if (!result.success) {
          return c.json(errorResponse(result.error), 400);
        }
      }
    ),
    async (c) => {
      const { data: resend, error: resendError } = await tryCatch(
        new Resend(env.RESEND_API_KEY)
      );

      if (resendError) {
        return c.json(errorGenerator(500), 500);
      }

      const data = c.req.valid("json");

      const result = await resend.emails.send({
        from: CONTACT_EMAIL,
        to: meta.email,
        subject: data.title,
        text: data.message,
        react: EmailTemplate({
          title: data.title,
          message: data.message,
          email: data.email,
          ip: c.get("clientIP"),
        }),
      });

      if (result.error) {
        return c.json(errorGenerator(500), 500);
      } else {
        return c.json(null);
      }
    }
  );

export default api;

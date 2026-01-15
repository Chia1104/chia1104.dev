import { createMiddleware } from "hono/factory";

import { captchaSiteverify, CaptchaError, ErrorCode } from "@chia/api/captcha";
import { tryCatch } from "@chia/utils/error-helper";
import { errorGenerator } from "@chia/utils/server";

export const siteverify = createMiddleware<HonoContext>(async (c, next) => {
  const { data: captcha, error: captchaError } = await tryCatch(
    captchaSiteverify(c.req.raw.clone())
  );

  if (captchaError) {
    if (captchaError instanceof CaptchaError) {
      console.error("Captcha error: ", {
        error: captchaError.code,
        response: captchaError,
        payload: c.req.raw.clone(),
      });
      return c.json(
        errorGenerator(400, [
          {
            field: "captcha",
            message: captchaError.code,
          },
        ]),
        400
      );
    }
    return c.json(errorGenerator(500), 500);
  }

  if (!captcha.success) {
    console.error("Captcha service response failed: ", {
      error: ErrorCode.CaptchaFailed,
      response: captcha,
      payload: c.req.raw.clone(),
    });
    return c.json(
      errorGenerator(400, [
        {
          field: "captcha",
          message: ErrorCode.CaptchaFailed,
        },
      ]),
      400
    );
  }
  await next();
});

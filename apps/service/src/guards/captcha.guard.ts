import { createMiddleware } from "hono/factory";

import { captchaSiteverify, CaptchaError, ErrorCode } from "@chia/api/captcha";
import { errorGenerator } from "@chia/utils";
import { tryCatch } from "@chia/utils/try-catch";

export const siteverify = createMiddleware<HonoContext>(async (c, next) => {
  const { data: captcha, error: captchaError } = await tryCatch(
    captchaSiteverify(c.req.raw)
  );

  if (captchaError) {
    if (captchaError instanceof CaptchaError) {
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

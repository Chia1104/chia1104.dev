import { sendContactEmail } from "../../email";
import { callerGuard } from "../guards/caller.guard";
import { captchaGuard } from "../guards/captcha.guard";
import { rateLimitGuard } from "../guards/rate-limit.guard";
import { contractOS } from "../utils";

export const sendContactEmailRoute = contractOS.email.send
  .use(callerGuard())
  .use(rateLimitGuard("email"))
  .use(captchaGuard.adaptInput((input) => ({ token: input.captchaToken })))
  .handler(async (opts) => {
    await sendContactEmail({
      email: opts.input.email,
      title: opts.input.title,
      message: opts.input.message,
      ip: opts.context.clientIP,
    });

    return null;
  });

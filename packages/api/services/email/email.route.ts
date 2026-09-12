import { sendContactEmail } from "../../email";
import { contractOS } from "../shared/context";
import { callerGuard } from "../shared/guards/caller.guard";
import { captchaGuard } from "../shared/guards/captcha.guard";
import { rateLimitGuard } from "../shared/guards/rate-limit.guard";

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

export const emailRouter = contractOS.email.router({
  send: sendContactEmailRoute,
});

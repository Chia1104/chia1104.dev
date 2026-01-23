import { baseOS } from "../utils";

export const authGuard = baseOS
  .errors({
    UNAUTHORIZED: {},
  })
  .middleware(async ({ next, context, errors }) => {
    const sessionData =
      context.session ??
      (await context.auth.api.getSession({
        headers: context.headers,
      }));

    if (!sessionData?.session || !sessionData?.user) {
      if (context.hooks?.onUnauthorized) {
        context.hooks.onUnauthorized(errors.UNAUTHORIZED());
      }
      throw errors.UNAUTHORIZED();
    }

    return next({
      context: {
        session: sessionData,
      },
    });
  });

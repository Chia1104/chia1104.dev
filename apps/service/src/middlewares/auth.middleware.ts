/**
 * TODO: implement auth middleware
 * (issue: https://github.com/honojs/middleware/issues/665)
 */
import type { AuthUser } from "@hono/auth-js";
import dayjs from "dayjs";
import { getCookie, deleteCookie, setCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";

import { adapter } from "@chia/auth-core/adapter";
import {
  SESSION_TOKEN,
  SESSION_MAX_AGE,
  SESSION_UPDATE_AGE,
  sessionCookieOptions,
} from "@chia/auth-core/utils";
import { errorGenerator } from "@chia/utils";

import { env } from "@/env";

function fromDate(time: number, date = Date.now()) {
  return new Date(date + time * 1000);
}

export const verifyAuth = () =>
  createMiddleware<HonoContext>(async (c, next) => {
    try {
      const { getSessionAndUser, deleteSession, updateSession } = adapter({
        db: c.var.db,
        redis: c.var.redis,
      });
      const sessionToken = getCookie(c, SESSION_TOKEN);
      if (!sessionToken) {
        return c.json(errorGenerator(401), 401);
      }
      let userAndSession = await getSessionAndUser(sessionToken);

      /**
       * TODO: maybe remove this block, redis should handle session expiration
       */
      if (
        userAndSession &&
        userAndSession.session.expires.valueOf() < Date.now()
      ) {
        await deleteSession(sessionToken);
        userAndSession = null;
      }

      if (userAndSession) {
        const { session } = userAndSession;

        // Calculate last updated date to throttle write updates to database
        // Formula: ({expiry date} - sessionMaxAge) + sessionUpdateAge
        //     e.g. ({expiry date} - 30 days) + 1 hour
        const sessionIsDueToBeUpdatedDate =
          session.expires.valueOf() -
          SESSION_MAX_AGE * 1000 +
          SESSION_UPDATE_AGE * 1000;

        const newExpires = fromDate(SESSION_MAX_AGE);
        // Trigger update of session expiry date and write to database, only
        // if the session was last updated more than {sessionUpdateAge} ago
        if (sessionIsDueToBeUpdatedDate <= Date.now()) {
          await updateSession({
            sessionToken: sessionToken,
            expires: newExpires,
          });
        }

        // Set cookie again to update expiry
        setCookie(c, SESSION_TOKEN, sessionToken, {
          ...sessionCookieOptions(env),
          expires: newExpires,
        });

        const newSession = await getSessionAndUser(sessionToken);

        if (!newSession) {
          return c.json(errorGenerator(401), 401);
        }

        c.set("authUser", {
          session: {
            expires: dayjs(newSession.session.expires).toISOString(),
            user: newSession.user,
          },
          user: newSession.user,
        } satisfies AuthUser);

        await next();
      } else if (sessionToken) {
        // If `sessionToken` was found set but it's not valid for a session then
        // remove the sessionToken cookie from browser.
        deleteCookie(c, SESSION_TOKEN);
      }
    } catch (error) {
      console.error(error);
      throw new HTTPException(500, {
        message: "Internal Server Error",
      });
    }
  });
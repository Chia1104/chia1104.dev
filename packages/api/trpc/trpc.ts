import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

import type { Session } from "@chia/auth-core/types";
import { createRedis } from "@chia/cache";
import { getDB } from "@chia/db";
import { getAdminId } from "@chia/utils";

interface CreateContextOptions {
  session: Session | null;
}

const database = getDB();

const redis = createRedis();

const adminId = getAdminId();

const createInnerTRPCContext = (opts: CreateContextOptions) => {
  return {
    session: opts.session,
    db: database,
    redis,
  };
};

export const createTRPCContext = (opts: {
  /**
   * @deprecated
   */
  req?: Request;
  auth?: Session | null;
}) => {
  const session = opts.auth ?? null;

  return createInnerTRPCContext({
    session,
  });
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createTRPCRouter = t.router;

export const publicProcedure = t.procedure;

const enforceUserIsAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user || !ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      // infers the `session` as non-nullable
      session: { ...ctx.session, user: ctx.session.user },
    },
  });
});

export const protectedProcedure = t.procedure.use(enforceUserIsAuthed);

const dangerous_isAdmin = t.middleware(({ ctx, next }) => {
  return next({
    ctx: {
      ...ctx,
      adminId,
    },
  });
});

export const authGuard = (input?: string): input is string => !!input;

export const adminProcedure = t.procedure.use(dangerous_isAdmin);

export const enforceUserIsAdmin = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user || !ctx.session || ctx.session.user.id !== adminId) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next();
});

export const onlyAdminProcedure = t.procedure
  .use(enforceUserIsAdmin)
  .use(dangerous_isAdmin);

/**
 * Create a server-side caller
 * @see https://trpc.io/docs/server/server-side-calls
 */
export const createCallerFactory = t.createCallerFactory;

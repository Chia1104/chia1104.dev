import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { treeifyError } from "zod";

import { auth } from "@chia/auth";
import type { Session } from "@chia/auth/types";
import type { DB } from "@chia/db";
import type { Feed } from "@chia/db/schema";
import { Role } from "@chia/db/types";
import type { Keyv } from "@chia/kv";
import { getAdminId } from "@chia/utils";

const adminId = getAdminId();

export const createTRPCContext = (opts: {
  headers: Headers;
  session?: Session | null;
  db: DB;
  redis: Keyv;
  hooks?: {
    onError?: (error: TRPCError) => void;
    onUnauthorized?: (error: TRPCError) => void;
    onForbidden?: (error: TRPCError) => void;
    onFeedCreated?: (feed: Feed) => Promise<void>;
    onFeedUpdated?: (feed: Feed) => Promise<void>;
  };
}) => {
  return opts;
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? treeifyError(error.cause) : null,
      },
    };
  },
});

export const createTRPCRouter = t.router;

export const publicProcedure = t.procedure;

const enforceUserIsAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user || !ctx.session) {
    if (ctx.hooks?.onUnauthorized) {
      ctx.hooks.onUnauthorized(new TRPCError({ code: "UNAUTHORIZED" }));
    }
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

export const adminProcedure = t.procedure.use(dangerous_isAdmin);

export const enforceUserIsRootAdmin = t.middleware(({ ctx, next }) => {
  if (
    !ctx.session?.user ||
    !ctx.session ||
    ctx.session.user.role !== Role.Root
  ) {
    if (ctx.hooks?.onForbidden) {
      ctx.hooks.onForbidden(new TRPCError({ code: "FORBIDDEN" }));
    }
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next();
});

export const onlyRootAdminProcedure = t.procedure
  .use(enforceUserIsRootAdmin)
  .use(dangerous_isAdmin);

export const adminACLMiddleware = (
  permission: Record<string, string[]>,
  rootOnly?: boolean
) =>
  t.middleware(async ({ ctx, next }) => {
    if (!ctx.session?.user || !ctx.session) {
      if (ctx.hooks?.onUnauthorized) {
        ctx.hooks.onUnauthorized(new TRPCError({ code: "UNAUTHORIZED" }));
      }
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    const valid = await auth.api.userHasPermission({
      body: {
        userId: ctx.session.user.id,
        permission,
      },
    });

    if (!valid || (rootOnly && ctx.session.user.role !== Role.Root)) {
      if (ctx.hooks?.onForbidden) {
        ctx.hooks.onForbidden(new TRPCError({ code: "FORBIDDEN" }));
      }
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    return next({
      ctx: {
        // infers the `session` as non-nullable
        session: { ...ctx.session, user: ctx.session.user },
      },
    });
  });

export const adminProcedureWithACL = (
  permission: Record<string, string[]>,
  rootOnly?: boolean
) => t.procedure.use(adminACLMiddleware(permission, rootOnly));

export const external_createTRPCContext = (opts: {
  internal_requestSecret: {
    cfBypassToken: string;
    apiKey: string;
  };
}) => {
  return {
    internal_requestSecret: opts.internal_requestSecret,
  };
};

const external_trpc = initTRPC
  .context<typeof external_createTRPCContext>()
  .create({
    transformer: superjson,
    errorFormatter({ shape, error }) {
      return {
        ...shape,
        data: {
          ...shape.data,
          zodError:
            error.cause instanceof ZodError ? treeifyError(error.cause) : null,
        },
      };
    },
  });

export const external_createTRPCRouter = external_trpc.router;

export const external_procedure = external_trpc.procedure;

export const external_middleware = external_trpc.middleware(({ ctx, next }) => {
  if (!ctx.internal_requestSecret) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next();
});

/**
 * Create a server-side caller
 * @see https://trpc.io/docs/server/server-side-calls
 */
export const createCallerFactory = t.createCallerFactory;
export const external_createCallerFactory = external_trpc.createCallerFactory;

export const authGuard = (input?: string): input is string => !!input;

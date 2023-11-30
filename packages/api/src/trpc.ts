import { auth, type Session } from "@chia/auth";
import { db, betaDb, localDb } from "@chia/db";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { getDb, getAdminId } from "@chia/utils";

type CreateContextOptions = {
  session: Session | null;
};

const database = getDb(undefined, {
  db,
  betaDb,
  localDb,
});

const adminId = getAdminId();

const createInnerTRPCContext = (opts: CreateContextOptions) => {
  return {
    session: opts.session,
    db: database,
  };
};

export const createTRPCContext = async (opts: {
  req?: Request;
  auth?: Session | null;
}) => {
  const session = opts.auth ?? (await auth());
  const source = opts.req?.headers.get("x-trpc-source") ?? "unknown";

  console.log(">>> tRPC Request from", source, "by", session?.user);

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
  if (!ctx.session || !ctx.session.user) {
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
      adminId,
    },
  });
});

export const adminProcedure = t.procedure.use(dangerous_isAdmin);

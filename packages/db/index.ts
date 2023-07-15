import { PrismaClient } from "@prisma/client";
// import { PrismaClient as PrismaClientEdge } from "@prisma/client/edge";

export * from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  // prismaEdge?: PrismaClientEdge;
};

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// export const prismaEdge =
//   globalForPrisma.prismaEdge ||
//   new PrismaClientEdge({
//     log:
//       process.env.NODE_ENV === "development"
//         ? ["query", "error", "warn"]
//         : ["error"],
//   });
//
// if (process.env.NODE_ENV !== "production")
//   globalForPrisma.prismaEdge = prismaEdge;

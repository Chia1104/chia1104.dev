import { PrismaClient } from "@prisma/client";
import { IS_PRODUCTION } from "@chia/shared/constants";

const prismaGlobal = global as typeof global & {
  prisma?: PrismaClient;
};

export const prisma: PrismaClient =
  prismaGlobal.prisma ||
  new PrismaClient({
    log: !IS_PRODUCTION ? ["query", "error", "warn"] : ["error"],
  });

if (!IS_PRODUCTION) {
  prismaGlobal.prisma = prisma;
}

import type { BaseOSContext } from "@chia/api/orpc/utils";
import type { Session } from "@chia/auth/types";
import type { ServiceContext } from "@chia/service-kit/context";

export const contextOf = (
  session: Session | null,
  extra: Partial<BaseOSContext> = {}
): BaseOSContext =>
  /* SAFETY: This fixture implements the BaseOSContext members exercised by oRPC tests. */ ({
    headers: new Headers(),
    clientIP: "127.0.0.1",
    config: { rateLimit: { windowMs: 60_000, limit: 100 } },
    db: {},
    session,
    ...extra,
  }) as BaseOSContext;

export const serviceContextOf = (
  overrides: Partial<ServiceContext> = {}
): ServiceContext =>
  /* SAFETY: This fixture implements the ServiceContext members exercised by policy tests. */ ({
    headers: new Headers(),
    clientIP: "1.2.3.4",
    db: {},
    kv: undefined,
    ...overrides,
  }) as ServiceContext;

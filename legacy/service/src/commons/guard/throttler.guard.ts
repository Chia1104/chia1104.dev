import { ExecutionContext, Injectable } from "@nestjs/common";
import { GqlExecutionContext } from "@nestjs/graphql";
import { ThrottlerGuard } from "@nestjs/throttler";

@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, any>) {
    return req.ips.length ? req.ips[0] : req.ip;
  }
}

@Injectable()
export class GqlThrottlerGuard extends ThrottlerBehindProxyGuard {
  getRequestResponse(context: ExecutionContext) {
    const gqlCtx = GqlExecutionContext.create(context);
    const ctx = gqlCtx.getContext();
    return { req: ctx.req, res: ctx.res };
  }
}

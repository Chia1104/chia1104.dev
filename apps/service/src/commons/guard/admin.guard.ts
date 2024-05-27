import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Inject,
} from "@nestjs/common";
import { Auth, env } from "@chia/auth-core";
import type { Session } from "@chia/auth-core";
import { DRIZZLE_PROVIDER } from "@/modules/drizzle/drizzle.provider";
import type { DB } from "@chia/db";
import { getAdminId } from "@chia/utils";
import { dynamicImportPackage } from "@/utils/dynamic-import-package.util";
import type { Request } from "express";

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(@Inject(DRIZZLE_PROVIDER) private readonly db: DB) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const createActionURL = (
      await dynamicImportPackage<typeof import("@auth/core")>("@auth/core")
    ).createActionURL;

    const request = context.switchToHttp().getRequest<Request>();

    const url = createActionURL(
      "session",
      request.protocol,
      new Headers(request.headers as HeadersInit),
      process.env,
      "/auth"
    );

    const response = await Auth(
      new Request(url, { headers: { cookie: request.headers.cookie ?? "" } }),
      {
        secret: env.AUTH_SECRET,
      }
    );
    const { status = 200 } = response;

    const data = (await response.json()) as Session | null;

    if (!data || !Object.keys(data).length) return false;
    if (status === 200) return data.user.id === getAdminId();
    return false;
  }
}

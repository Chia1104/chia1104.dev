import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Inject,
} from "@nestjs/common";
import { getBaseConfig } from "@chia/auth";
import env from "@/config/env";
import { dynamicImportPackage } from "@/utils/dynamic-import-package.util";
import { DRIZZLE_PROVIDER } from "@/modules/drizzle/drizzle.provider";
import { type DB, tableCreator } from "@chia/db";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(DRIZZLE_PROVIDER) private readonly db: DB) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const Auth = (
      await dynamicImportPackage<typeof import("@auth/core")>("@auth/core")
    ).Auth;
    const DrizzleAdapter = (
      await dynamicImportPackage<typeof import("@auth/drizzle-adapter")>(
        "@auth/drizzle-adapter"
      )
    ).DrizzleAdapter;
    const Google = (
      await dynamicImportPackage<typeof import("@auth/core/providers/google")>(
        "@auth/core/providers/google"
      )
    ).default;
    const createActionURL = (
      await dynamicImportPackage<typeof import("@auth/core")>("@auth/core")
    ).createActionURL;

    const request = context.switchToHttp().getRequest();

    const url = createActionURL(
      "session",
      request.protocol,
      new Headers(request.headers),
      process.env,
      "/auth"
    );

    const response = await Auth(
      new Request(url, { headers: { cookie: request.headers.cookie ?? "" } }),
      {
        ...getBaseConfig(),
        secret: env().AUTH_SECRET,
        basePath: "/auth",
        adapter: DrizzleAdapter(this.db, tableCreator),
        providers: [
          Google({
            clientId: env().GOOGLE_CLIENT_ID,
            clientSecret: env().GOOGLE_CLIENT_SECRET,
            allowDangerousEmailAccountLinking: true,
          }),
        ],
      }
    );
    const { status = 200 } = response;

    const data = await response.json();

    if (!data || !Object.keys(data).length) return false;
    if (status === 200) return true;
    return false;
  }
}

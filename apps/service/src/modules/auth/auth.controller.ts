import {
  Controller,
  Get,
  InternalServerErrorException,
  Inject,
  Req,
  Res,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { getBaseConfig } from "@chia/auth";
import { toWebRequest, toExpressResponse } from "@chia/utils";
import {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from "express";
import env from "@/config/env";
import { DRIZZLE_PROVIDER } from "../drizzle/drizzle.provider";
import { type DB, tableCreator } from "@chia/db";
import { dynamicImportPackage } from "@/utils/dynamic-import-package.util";

@ApiTags("Auth")
@Controller("auth")
class AuthController {
  constructor(@Inject(DRIZZLE_PROVIDER) private readonly db: DB) {}

  @Get("session")
  @ApiOperation({ summary: "Get session" })
  @ApiResponse({ status: 500, description: "Internal server error" })
  async getSession(
    @Req() request: ExpressRequest,
    @Res() res: ExpressResponse
  ) {
    try {
      const Auth = (
        await dynamicImportPackage<typeof import("@auth/core")>("@auth/core")
      ).Auth;
      const DrizzleAdapter = (
        await dynamicImportPackage<typeof import("@auth/drizzle-adapter")>(
          "@auth/drizzle-adapter"
        )
      ).DrizzleAdapter;
      const Google = (
        await dynamicImportPackage<
          typeof import("@auth/core/providers/google")
        >("@auth/core/providers/google")
      ).default;
      const result = await Auth(toWebRequest(request), {
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
      });
      return await toExpressResponse(result, res);
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException();
    }
  }
}

export default AuthController;

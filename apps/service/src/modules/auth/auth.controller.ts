import {
  Controller,
  Get,
  InternalServerErrorException,
  Inject,
  Req,
  Res,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Auth, env } from "@chia/auth-core";
import { toWebRequest, toExpressResponse } from "@chia/utils";
import {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from "express";
import { DRIZZLE_PROVIDER } from "../drizzle/drizzle.provider";
import { type DB } from "@chia/db";

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
      const result = await Auth(toWebRequest(request), {
        secret: env.AUTH_SECRET,
      });
      return await toExpressResponse(result, res);
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException();
    }
  }
}

export default AuthController;

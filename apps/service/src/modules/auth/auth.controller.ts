import { Controller, Get, Req, Res } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from "express";
import AuthService from "./auth.service";

@ApiTags("Auth")
@Controller("auth")
class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get("*")
  @ApiOperation({ summary: "auth routes" })
  @ApiResponse({ status: 500, description: "Internal server error" })
  async authRoutes(
    @Req() request: ExpressRequest,
    @Res() response: ExpressResponse
  ) {
    return await this.authService.auth(request, response);
  }
}

export default AuthController;

import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  HttpException,
  Query,
  Param,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from "express";

import { AuthErrorDto, OAuthProviderDto } from "./auth.dto";
import AuthService from "./auth.service";

@ApiTags("Auth")
@Controller("auth")
class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get("/session")
  @ApiOperation({
    summary: "Returns the user’s session if it exists, otherwise `null`",
  })
  @ApiResponse({ status: 500, description: "Internal server error" })
  async authSessionGetHandler(
    @Req() request: ExpressRequest,
    @Res() response: ExpressResponse
  ) {
    return await this.authService.auth(request, response);
  }

  @Post("/session")
  @ApiOperation({
    summary: "Updates the user’s session and returns the updated session.",
  })
  @ApiResponse({ status: 500, description: "Internal server error" })
  async authSessionPostHandler(
    @Req() request: ExpressRequest,
    @Res() response: ExpressResponse
  ) {
    return await this.authService.auth(request, response);
  }

  @Get("/callback/:provider")
  @ApiOperation({
    summary: "Handles the callback from an OAuth provider",
  })
  @ApiResponse({ status: 500, description: "Internal server error" })
  async authCallbackGoogleGetHandler(
    @Req() request: ExpressRequest,
    @Res() response: ExpressResponse,
    @Param() _params: OAuthProviderDto
  ) {
    return await this.authService.auth(request, response);
  }

  @Post("/callback/:provider")
  @ApiOperation({
    summary: "Handles the callback from a Credentials provider",
  })
  @ApiResponse({ status: 500, description: "Internal server error" })
  async authCallbackGooglePostHandler(
    @Req() request: ExpressRequest,
    @Res() response: ExpressResponse,
    @Param() _params: OAuthProviderDto
  ) {
    return await this.authService.auth(request, response);
  }

  @Get("/error")
  @ApiOperation({
    summary: "Handles an error during authentication",
  })
  @ApiResponse({ status: 500, description: "Internal server error" })
  async authErrorGetHandler(
    @Req() request: ExpressRequest,
    @Res() response: ExpressResponse,
    @Query() query: AuthErrorDto
  ) {
    return await this.authService.auth(request, response, {
      onAuthError: new HttpException(
        query.error ?? "Authentication error",
        400
      ),
    });
  }

  @Get("/csrf")
  @ApiOperation({
    summary:
      "Returns the raw CSRF token, which is saved in a cookie (encrypted). It is used for CSRF protection, implementing the double submit cookie technique.",
  })
  @ApiResponse({ status: 500, description: "Internal server error" })
  async authCsrfGetHandler(
    @Req() request: ExpressRequest,
    @Res() response: ExpressResponse
  ) {
    return await this.authService.auth(request, response);
  }

  @Get("/providers")
  @ApiOperation({
    summary: "Returns a client-safe list of all configured providers.",
  })
  @ApiResponse({ status: 500, description: "Internal server error" })
  async authProvidersGetHandler(
    @Req() request: ExpressRequest,
    @Res() response: ExpressResponse
  ) {
    return await this.authService.auth(request, response);
  }

  @Post("/signin/:provider")
  @ApiOperation({
    summary: "Initiates the sign-in flow.",
  })
  @ApiResponse({ status: 500, description: "Internal server error" })
  async authSigninProviderPostHandler(
    @Req() request: ExpressRequest,
    @Res() response: ExpressResponse,
    @Param() _params: OAuthProviderDto
  ) {
    return await this.authService.auth(request, response);
  }

  @Post("/signout")
  @ApiOperation({
    summary:
      "Initiates the sign-out flow. This will invalidate the user’s session (deleting the cookie, and if there is a session in the database, it will be deleted as well).",
  })
  @ApiResponse({ status: 500, description: "Internal server error" })
  async authSignoutPostHandler(
    @Req() request: ExpressRequest,
    @Res() response: ExpressResponse
  ) {
    return await this.authService.auth(request, response);
  }
}

export default AuthController;

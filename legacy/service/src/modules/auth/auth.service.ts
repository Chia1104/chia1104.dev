import {
  Injectable,
  InternalServerErrorException,
  HttpException,
} from "@nestjs/commons";
import {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from "express";

import { Auth } from "@chia/auth-core";
import { toWebRequest, toExpressResponse } from "@chia/utils";

interface AuthOptions {
  onAuthError?: HttpException;
}

@Injectable()
class AuthService {
  async auth(
    request: ExpressRequest,
    response: ExpressResponse,
    options?: AuthOptions
  ) {
    try {
      const result = await Auth(toWebRequest(request));
      if (
        !result.ok &&
        result.status !== 302 &&
        request.path !== "/auth/error"
      ) {
        throw (
          options.onAuthError ??
          new HttpException(await result.text(), result.status)
        );
      } else if (request.path === "/auth/error") {
        throw (
          options.onAuthError ??
          new HttpException("Authentication error", result.status)
        );
      }
      return await toExpressResponse(result, response);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException();
    }
  }
}

export default AuthService;

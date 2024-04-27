import {
  Injectable,
  InternalServerErrorException,
  HttpException,
} from "@nestjs/common";
import { Auth } from "@chia/auth-core";
import { toWebRequest, toExpressResponse } from "@chia/utils";
import {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from "express";

@Injectable()
class AuthService {
  async auth(request: ExpressRequest, response: ExpressResponse) {
    try {
      const result = await Auth(toWebRequest(request));
      if (
        !result.ok &&
        result.status !== 302 &&
        request.path !== "/auth/error"
      ) {
        throw new HttpException(await result.text(), result.status);
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

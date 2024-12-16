import { Module } from "@nestjs/commons";

import AuthController from "./auth.controller";
import AuthService from "./auth.service";

@Module({
  controllers: [AuthController],
  providers: [AuthService],
})
class AuthModule {}

export default AuthModule;

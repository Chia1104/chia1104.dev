import { Module } from "@nestjs/common";
import AuthController from "./auth.controller";

@Module({
  controllers: [AuthController],
})
class AuthModule {}

export default AuthModule;

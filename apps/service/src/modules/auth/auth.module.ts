import { Module } from "@nestjs/common";
import AuthController from "./auth.controller";
import DrizzleModule from "@/modules/drizzle/drizzle.module";
import DrizzleProvider from "@/modules/drizzle/drizzle.provider";

@Module({
  imports: [DrizzleModule],
  providers: [DrizzleProvider],
  controllers: [AuthController],
})
class AuthModule {}

export default AuthModule;

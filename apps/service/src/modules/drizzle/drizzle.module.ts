import { Module } from "@nestjs/common";
import DrizzleProvider from "@/modules/drizzle/drizzle.provider";

@Module({
  providers: [DrizzleProvider],
  exports: [DrizzleProvider],
})
class DrizzleModule {}

export default DrizzleModule;

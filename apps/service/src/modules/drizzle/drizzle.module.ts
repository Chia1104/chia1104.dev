import { Module } from "@nestjs/common";
import DrizzleProvider from "@/modules/drizzle/drizzle.provider";

@Module({
  providers: [DrizzleProvider],
})
class DrizzleModule {}

export default DrizzleModule;

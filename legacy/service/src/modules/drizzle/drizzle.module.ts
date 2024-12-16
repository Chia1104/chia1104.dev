import { Module } from "@nestjs/commons";

import DrizzleProvider from "@/modules/drizzle/drizzle.provider";

@Module({
  providers: [DrizzleProvider],
  exports: [DrizzleProvider],
})
class DrizzleModule {}

export default DrizzleModule;

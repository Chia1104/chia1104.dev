import { Module } from "@nestjs/common";
import { drizzleProviders } from "./drizzle.provider";

@Module({
  providers: [...drizzleProviders],
})
class DrizzleModule {}

export default DrizzleModule;

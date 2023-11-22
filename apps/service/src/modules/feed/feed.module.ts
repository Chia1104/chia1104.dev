import { Module } from "@nestjs/common";
import FeedService from "./feed.service";
import FeedController from "./feed.controller";
import FeedResolver from "./feed.resolver";
import DrizzleModule from "@/modules/drizzle/drizzle.module";
import DrizzleProvider from "@/modules/drizzle/drizzle.provider";

@Module({
  imports: [DrizzleModule],
  providers: [FeedService, FeedResolver, DrizzleProvider],
  controllers: [FeedController],
})
class FeedsModule {}

export default FeedsModule;

import { Module } from "@nestjs/common";
import FeedService from "./feed.service";
import FeedController from "./feed.controller";
import FeedResolver from "./feed.resolver";

@Module({
  providers: [FeedService, FeedResolver],
  controllers: [FeedController],
})
class FeedsModule {}

export default FeedsModule;

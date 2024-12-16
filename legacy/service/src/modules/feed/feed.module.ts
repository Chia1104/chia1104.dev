import { Module } from "@nestjs/commons";

import FeedController from "./feed.controller";
import FeedResolver from "./feed.resolver";
import FeedService from "./feed.service";

@Module({
  providers: [FeedService, FeedResolver],
  controllers: [FeedController],
})
class FeedsModule {}

export default FeedsModule;

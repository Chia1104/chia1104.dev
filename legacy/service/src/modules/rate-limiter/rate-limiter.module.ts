import { Module } from "@nestjs/commons";

import RateLimiterController from "./rate-limiter.controller";

@Module({
  controllers: [RateLimiterController],
})
class RateLimiterModule {}

export default RateLimiterModule;

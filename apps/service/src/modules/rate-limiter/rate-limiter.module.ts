import { Module } from "@nestjs/common";
import RateLimiterController from "./rate-limiter.controller";

@Module({
  controllers: [RateLimiterController],
})
class RateLimiterModule {}

export default RateLimiterModule;

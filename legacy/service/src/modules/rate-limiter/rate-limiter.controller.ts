import { Controller, Post, UseGuards } from "@nestjs/commons";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

import { ThrottlerBehindProxyGuard } from "@/commons/guard/throttler.guard";

@ApiTags("RateLimiter")
@Controller("rate-limiter")
class RateLimiterController {
  @Post()
  @ApiOperation({ summary: "Check rate limiting" })
  @ApiResponse({
    status: 429,
    description: "ThrottlerException: Too Many Requests",
  })
  @UseGuards(ThrottlerBehindProxyGuard)
  checkRateLimiting() {
    return {
      ip: "foo",
      success: true,
    };
  }
}

export default RateLimiterController;

import { Controller, Post, UseGuards } from "@nestjs/common";
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
  async checkRateLimiting(): Promise<{
    ip: string;
    success: boolean;
  }> {
    return {
      ip: "foo",
      success: true,
    };
  }
}

export default RateLimiterController;

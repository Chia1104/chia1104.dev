import { ThrottlerModule, seconds } from "@nestjs/throttler";
import { ThrottlerStorageRedisService } from "nestjs-throttler-storage-redis";
import Redis from "ioredis";
import ConfigModule from "@/config";
import type { AppEnv } from "@/config";
import { ConfigService } from "@nestjs/config";

export default ThrottlerModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService<AppEnv>) => ({
    throttlers: [
      {
        limit: Number(config.get("THROTTLE_LIMIT")) || 10,
        ttl: seconds(Number(config.get("THROTTLE_TTL") ?? 60)),
      },
    ],
    storage: new ThrottlerStorageRedisService(
      new Redis(config.get("REDIS_URL") ?? config.get("REDIS_URI"))
    ),
  }),
});

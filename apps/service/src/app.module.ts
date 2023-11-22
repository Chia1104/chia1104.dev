import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AppController } from "./app.controller";
import FeedModule from "@/modules/feed/feed.module";
import RateLimiterModule from "@/modules/rate-limiter/rate-limiter.module";
import { GraphQLModule } from "@nestjs/graphql";
import { ApolloDriver, ApolloDriverConfig } from "@nestjs/apollo";
import { join } from "path";
import { ThrottlerModule, seconds } from "@nestjs/throttler";
import { ThrottlerStorageRedisService } from "nestjs-throttler-storage-redis";
import Redis from "ioredis";
import { ApolloServerPluginLandingPageLocalDefault } from "@apollo/server/plugin/landingPage/default";

@Module({
  imports: [
    FeedModule,
    RateLimiterModule,
    ConfigModule.forRoot(),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), "src/schema.gql"),
      sortSchema: true,
      subscriptions: {
        "graphql-ws": true,
      },
      playground: false,
      introspection: true,
      plugins: [ApolloServerPluginLandingPageLocalDefault()],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (
        config: ConfigService<{
          THROTTLE_LIMIT: string;
          THROTTLE_TTL: string;
          REDIS_URI: string;
        }>
      ) => ({
        throttlers: [
          {
            limit: Number(config.get("THROTTLE_LIMIT")) || 10,
            ttl: seconds(Number(config.get("THROTTLE_TTL") ?? 60)),
          },
        ],
        storage: new ThrottlerStorageRedisService(
          new Redis(config.get("REDIS_URI"))
        ),
      }),
    }),
  ],
  controllers: [AppController],
})
export class AppModule {}

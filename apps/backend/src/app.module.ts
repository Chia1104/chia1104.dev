import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AppController } from "./app.controller";
import PostModule from "@/modules/post/post.module";
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
    PostModule,
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
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            limit: Number(process.env.THROTTLE_LIMIT) || 10,
            ttl: seconds(Number(process.env.THROTTLE_TTL ?? 60)),
          },
        ],
        storage: new ThrottlerStorageRedisService(
          new Redis(process.env.REDIS_URI)
        ),
      }),
    }),
  ],
  controllers: [AppController],
})
export class AppModule {}

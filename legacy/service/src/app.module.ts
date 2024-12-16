import { Module, Global } from "@nestjs/commons";

import ConfigModule from "@/config";
import AuthModule from "@/modules/auth/auth.module";
import FeedModule from "@/modules/feed/feed.module";
import RateLimiterModule from "@/modules/rate-limiter/rate-limiter.module";
import SpotifyModule from "@/modules/spotify/spotify.module";
import ThrottlerModule from "@/modules/throttler";

import { AppController } from "./app.controller";
import DrizzleModule from "./modules/drizzle/drizzle.module";
import DrizzleProvider from "./modules/drizzle/drizzle.provider";
import GraphQLModule from "./modules/graphql";

@Global()
@Module({
  imports: [
    AuthModule,
    FeedModule,
    SpotifyModule,
    RateLimiterModule,
    ConfigModule,
    GraphQLModule,
    ThrottlerModule,
    DrizzleModule,
  ],
  controllers: [AppController],
  providers: [DrizzleProvider],
  exports: [DrizzleProvider],
})
export class AppModule {}

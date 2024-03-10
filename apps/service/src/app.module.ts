import { Module, Global } from "@nestjs/common";
import { AppController } from "./app.controller";
import FeedModule from "@/modules/feed/feed.module";
import SpotifyModule from "@/modules/spotify/spotify.module";
import RateLimiterModule from "@/modules/rate-limiter/rate-limiter.module";
import GraphQLModule from "./modules/graphql";
import ConfigModule from "@/config";
import ThrottlerModule from "@/modules/throttler";
import AuthModule from "@/modules/auth/auth.module";
import DrizzleModule from "./modules/drizzle/drizzle.module";
import DrizzleProvider from "./modules/drizzle/drizzle.provider";

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

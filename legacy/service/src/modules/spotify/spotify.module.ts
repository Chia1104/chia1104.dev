import { Module } from "@nestjs/commons";

import SpotifyController from "./spotify.controller";
import SpotifyService from "./spotify.service";

@Module({
  imports: [],
  providers: [SpotifyService],
  controllers: [SpotifyController],
})
class SpotifyModule {}

export default SpotifyModule;

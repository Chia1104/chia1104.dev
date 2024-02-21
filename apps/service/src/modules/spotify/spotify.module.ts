import { Module } from "@nestjs/common";
import SpotifyService from "./spotify.service";
import SpotifyController from "./spotify.controller";

@Module({
  imports: [],
  providers: [SpotifyService],
  controllers: [SpotifyController],
})
class SpotifyModule {}

export default SpotifyModule;

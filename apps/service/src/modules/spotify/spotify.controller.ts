import {
  Controller,
  Post,
  Get,
  InternalServerErrorException,
  HttpException,
  Query,
  Body,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import SpotifyService from "./spotify.service";
import {
  AuthorizeSpotifyDto,
  AuthorizeCodeDto,
} from "@/shared/dto/spotify.dto";
import { HTTPError } from "ky";
import { AdminGuard } from "@/commons/guard/admin.guard";

@ApiTags("OAuth Spotify")
@Controller("oauth/spotify")
@UseGuards(AdminGuard)
class SpotifyController {
  constructor(private readonly spotifyService: SpotifyService) {}

  @Post("authorize")
  @ApiOperation({ summary: "Authorize Spotify" })
  @ApiResponse({ status: 500, description: "Internal server error" })
  async authorize(@Body() dto: AuthorizeSpotifyDto) {
    try {
      const redirectUrl = this.spotifyService.generateAuthorizeUrl(dto);
      return { url: redirectUrl };
    } catch (error) {
      throw new InternalServerErrorException();
    }
  }

  @Get("callback")
  @ApiOperation({ summary: "Callback Spotify" })
  @ApiResponse({ status: 500, description: "Internal server error" })
  async codeAuthorize(
    @Query()
    query: AuthorizeCodeDto
  ) {
    try {
      const { code } = query;
      const { access_token, refresh_token } =
        await this.spotifyService.codeAuthorization(code);
      return { access_token, refresh_token };
    } catch (error) {
      console.error(error);
      if (error instanceof HTTPError) {
        throw new HttpException(
          error.response.statusText,
          error.response.status
        );
      }
      throw new InternalServerErrorException();
    }
  }
}

export default SpotifyController;

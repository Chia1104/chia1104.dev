import { Injectable } from "@nestjs/common";
import { Buffer } from "buffer";
import ky from "ky";

import env from "@/config/env";
import { AuthorizeSpotifyDto } from "@/shared/dto/spotify.dto";

@Injectable()
class SpotifyService {
  generateAuthorizeUrl(dto: AuthorizeSpotifyDto) {
    const clientId = env().SPOTIFY_CLIENT_ID;
    const redirectUri = env().SPOTIFY_REDIRECT_URI;
    const url = new URL("https://accounts.spotify.com/authorize");
    url.searchParams.append("client_id", clientId);
    url.searchParams.append("response_type", "code");
    url.searchParams.append("redirect_uri", redirectUri);
    url.searchParams.append("state", dto.state);
    url.searchParams.append("scope", dto.scopes.join(" "));
    return url.toString();
  }

  codeAuthorization(code: string) {
    const clientId = env().SPOTIFY_CLIENT_ID;
    const clientSecret = env().SPOTIFY_CLIENT_SECRET;
    const redirectUri = env().SPOTIFY_REDIRECT_URI;
    return ky
      .post("https://accounts.spotify.com/api/token", {
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          Authorization:
            "Basic " +
            Buffer.from(clientId + ":" + clientSecret).toString("base64"),
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
        }),
      })
      .json<{
        access_token: string;
        token_type: string;
        expires_in: number;
        refresh_token: string;
        scope: string;
      }>();
  }
}

export default SpotifyService;

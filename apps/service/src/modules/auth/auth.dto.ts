import { IsEnum, IsOptional } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { AuthError, OAuthProvider } from "./types";

export class AuthErrorDto {
  @IsEnum(AuthError)
  @IsOptional()
  @ApiProperty({
    nullable: true,
    required: false,
    description: "The error that occurred during authentication",
  })
  error?: AuthError;
}

export class OAuthProviderDto {
  @IsEnum(OAuthProvider)
  @ApiProperty({
    required: true,
    description: "The OAuth provider to authenticate with",
  })
  provider: OAuthProvider;
}

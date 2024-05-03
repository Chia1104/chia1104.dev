import { IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class BaseHeadersDto {
  @IsString()
  @ApiProperty({
    nullable: false,
    required: true,
    description: "The CSRF token",
  })
  csrf: string;
}

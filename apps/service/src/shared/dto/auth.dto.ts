import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class BaseHeadersDto {
  @IsString()
  @ApiProperty({
    nullable: false,
    required: true,
    description: "The CSRF token",
  })
  csrf: string;
}

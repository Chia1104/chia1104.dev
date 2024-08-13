import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsNumberString, IsOptional } from "class-validator";

export class QueryFeedsDto {
  @IsNumberString()
  @IsOptional()
  @ApiProperty({
    nullable: true,
    required: false,
    description: "The number of posts to return",
    default: 10,
  })
  take?: string;

  @IsNumberString()
  @IsOptional()
  @ApiProperty({
    nullable: true,
    required: false,
    description: "The number of posts to skip",
    default: 0,
  })
  skip?: string;

  @IsEnum(["createdAt", "updatedAt", "id", "slug", "title"])
  @IsOptional()
  @ApiProperty({
    nullable: true,
    required: false,
    description: "The field to order posts by",
    enum: ["createdAt", "updatedAt", "id", "slug", "title"],
    default: "createdAt",
  })
  orderBy?: "createdAt" | "updatedAt" | "id" | "slug" | "title";

  @IsEnum(["asc", "desc"])
  @IsOptional()
  @ApiProperty({
    nullable: true,
    required: false,
    description: "The order to sort posts by",
    enum: ["asc", "desc"],
    default: "desc",
  })
  sortOrder?: "asc" | "desc";

  @IsEnum(["post", "note"])
  @IsOptional()
  @ApiProperty({
    nullable: true,
    required: false,
    description: "The type of feeds to return",
    enum: ["post", "note"],
    default: "post",
  })
  type?: "post" | "note";
}

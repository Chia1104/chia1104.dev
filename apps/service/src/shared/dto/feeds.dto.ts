import { IsEnum, IsNumberString, IsOptional } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class QueryFeedsDto {
  @IsNumberString()
  @IsOptional()
  @ApiProperty({
    description: "The number of posts to return",
    default: 10,
  })
  take: number;

  @IsNumberString()
  @IsOptional()
  @ApiProperty({
    description: "The number of posts to skip",
    default: 0,
  })
  skip: number;

  @IsEnum(["createdAt", "updatedAt", "id", "slug", "title"])
  @IsOptional()
  @ApiProperty({
    description: "The field to order posts by",
    enum: ["createdAt", "updatedAt", "id", "slug", "title"],
    default: "createdAt",
  })
  orderBy: "createdAt" | "updatedAt" | "id" | "slug" | "title";

  @IsEnum(["asc", "desc"])
  @IsOptional()
  @ApiProperty({
    description: "The order to sort posts by",
    enum: ["asc", "desc"],
    default: "desc",
  })
  sortOrder: "asc" | "desc";

  @IsEnum(["post", "note"])
  @IsOptional()
  @ApiProperty({
    description: "The type of feeds to return",
    enum: ["post", "note"],
    default: "post",
  })
  type: "post" | "note";
}

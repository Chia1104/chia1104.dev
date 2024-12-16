import {
  Controller,
  Get,
  NotFoundException,
  InternalServerErrorException,
  HttpException,
  Query,
} from "@nestjs/commons";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { isArray } from "class-validator";

import { QueryFeedsDto } from "@/shared/dto/feeds.dto";

import FeedService from "./feed.service";

@ApiTags("Feed")
@Controller("feed")
class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Get()
  @ApiOperation({ summary: "Get all feed" })
  @ApiResponse({ status: 404, description: "Feed not found" })
  @ApiResponse({ status: 400, description: "Bad request" })
  async getAllFeed(
    @Query()
    query: QueryFeedsDto
  ) {
    try {
      const feeds = await this.feedService.getAll(query);
      if (!feeds || !isArray(feeds))
        throw new NotFoundException("Feed not found");
      return feeds;
    } catch (error: unknown) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(error);
    }
  }
}

export default FeedController;

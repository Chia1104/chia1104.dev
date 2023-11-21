import {
  Controller,
  Get,
  NotFoundException,
  InternalServerErrorException,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import PostService from "./post.service";

@ApiTags("Post")
@Controller("post")
class PostController {
  constructor(private readonly postService: PostService) {}

  @Get()
  @ApiOperation({ summary: "Get all post" })
  @ApiResponse({ status: 404, description: "Not Found." })
  async getAllPost() {
    try {
      const posts = await this.postService.getAllPosts();
      if (!posts) throw new NotFoundException("Post not found");
      return posts;
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}

export default PostController;

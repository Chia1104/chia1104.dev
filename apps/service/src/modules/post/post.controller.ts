import { Controller, Get, NotFoundException } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import PostService from "./post.service";
import { type Post } from "@chia/db";

@ApiTags("Post")
@Controller("post")
class PostController {
  constructor(private readonly postService: PostService) {}

  @Get()
  @ApiOperation({ summary: "Get all post" })
  @ApiResponse({ status: 404, description: "Not Found." })
  async getAllPost(): Promise<Post[]> {
    const posts = await this.postService.getAllPosts();
    if (!posts) throw new NotFoundException("Post not found");
    return posts;
  }
}

export default PostController;

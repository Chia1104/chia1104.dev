import { Module } from "@nestjs/common";
import PostService from "./post.service";
import PostController from "./post.controller";
import PostResolver from "./post.resolver";

@Module({
  providers: [PostService, PostResolver],
  controllers: [PostController],
})
class ProductsModule {}

export default ProductsModule;

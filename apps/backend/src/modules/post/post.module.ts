import { Module } from "@nestjs/common";
import PostService from "./post.service";
import PostController from "./post.controller";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  providers: [PostService],
  controllers: [PostController],
  imports: [PrismaModule],
})
class ProductsModule {}

export default ProductsModule;

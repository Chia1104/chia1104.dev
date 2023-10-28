import "reflect-metadata";
import {
  Resolver,
  Query,
  Args,
  Context,
  InputType,
  Field,
  registerEnumType,
} from "@nestjs/graphql";
import { Inject } from "@nestjs/common";
import { Post } from "@/shared/models/post.model";
import { PrismaService } from "@/modules/prisma/prisma.service";

@InputType()
class PostOrderByUpdatedAtInput {
  @Field(() => SortOrder)
  updatedAt: SortOrder;
}

enum SortOrder {
  asc = "asc",
  desc = "desc",
}

registerEnumType(SortOrder, {
  name: "SortOrder",
});

@Resolver(Post)
class PostResolver {
  constructor(@Inject(PrismaService) private prismaService: PrismaService) {}

  /**
   * query ($take: Float) {
   *   feed(take: $take) {
   *     id
   *     content
   *   }
   * }
   *
   * variables:
   * {
   *  "take": 2
   * }
   *
   * @param searchString
   * @param skip
   * @param take
   * @param orderBy
   * @param ctx
   */
  @Query(() => [Post])
  feed(
    @Args("searchString", { nullable: true }) searchString: string,
    @Args("skip", { nullable: true }) skip: number,
    @Args("take", { nullable: true }) take: number,
    @Args("orderBy", { nullable: true }) orderBy: PostOrderByUpdatedAtInput,
    @Context() ctx
  ) {
    const or = searchString
      ? {
          OR: [
            { title: { contains: searchString } },
            { content: { contains: searchString } },
          ],
        }
      : {};

    return this.prismaService.post.findMany({
      where: {
        published: true,
        ...or,
      },
      take: take || undefined,
      skip: skip || undefined,
      orderBy: orderBy || undefined,
    });
  }
}

export default PostResolver;

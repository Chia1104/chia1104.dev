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
import { DRIZZLE_PROVIDER } from "../drizzle/drizzle.provider";
import { type DB, desc, schema } from "@chia/db";

@InputType()
class FeedOrderByUpdatedAtInput {
  @Field(() => SortOrder)
  updatedAt: SortOrder;
}

@InputType()
class FeedOrderByCreatedAtInput {
  @Field(() => SortOrder)
  createdAt: SortOrder;
}

@InputType()
class FeedOrderByIdInput {
  @Field(() => SortOrder)
  id: SortOrder;
}

@InputType()
class FeedOrderBySlugInput {
  @Field(() => SortOrder)
  slug: SortOrder;
}

@InputType()
class FeedTypeInput {
  @Field(() => FeedType)
  type: FeedType;
}

enum SortOrder {
  asc = "asc",
  desc = "desc",
}

registerEnumType(SortOrder, {
  name: "SortOrder",
});

enum FeedType {
  post = "post",
  note = "note",
}

registerEnumType(FeedType, {
  name: "feedType",
});

@Resolver(Post)
class PostResolver {
  constructor(@Inject(DRIZZLE_PROVIDER) private readonly db: DB) {}

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
  async feed(
    @Args("skip", { nullable: true }) skip: number,
    @Args("take", { nullable: true }) take: number,
    @Args("feedType", { nullable: true }) feedType: FeedTypeInput,
    @Args("orderBy", { nullable: true })
    orderBy:
      | FeedOrderByUpdatedAtInput
      | FeedOrderByCreatedAtInput
      | FeedOrderByIdInput
      | FeedOrderBySlugInput,
    @Context() ctx
  ) {
    const _orderBy = orderBy
      ? orderBy[Object.keys(orderBy)[0]] === "desc"
        ? desc(schema.feeds[Object.keys(orderBy)[0]])
        : schema.feeds[Object.keys(orderBy)[0]]
      : desc(schema.feeds.updatedAt);

    const _feedType = !!feedType.type
      ? feedType.type === "post"
        ? ({
            posts: true,
          } as const)
        : ({
            notes: true,
          } as const)
      : ({
          posts: true,
        } as const);

    return this.db.query.posts.findMany({
      limit: take || undefined,
      offset: skip || undefined,
      orderBy: _orderBy,
      with: {
        feeds: {
          with: _feedType,
        },
      },
    });
  }
}

export default PostResolver;

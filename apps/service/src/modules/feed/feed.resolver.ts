import "reflect-metadata";
import {
  Resolver,
  Query,
  Args,
  InputType,
  Field,
  registerEnumType,
} from "@nestjs/graphql";
import { Inject } from "@nestjs/common";
import { Feed } from "@/shared/models/feed.model";
import { DRIZZLE_PROVIDER } from "../drizzle/drizzle.provider";
import { type DB, desc, schema } from "@chia/db";

@InputType()
class FeedOrderByInput {
  @Field(() => SortOrder)
  updatedAt: SortOrder;

  @Field(() => SortOrder)
  createdAt: SortOrder;

  @Field(() => SortOrder)
  id: SortOrder;

  @Field(() => SortOrder)
  slug: SortOrder;
}

enum FeedType {
  post = "post",
  note = "note",
}

registerEnumType(FeedType, {
  name: "FeedType",
});

enum SortOrder {
  asc = "asc",
  desc = "desc",
}

registerEnumType(SortOrder, {
  name: "SortOrder",
});

@Resolver(Feed)
class FeedResolver {
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
   * @param skip
   * @param take
   * @param orderBy
   */
  @Query(() => [Feed])
  async feed(
    @Args("skip", { nullable: true }) skip: number,
    @Args("take", { nullable: true }) take: number,
    @Args("feedType", { nullable: true, defaultValue: FeedType.post })
    feedType: FeedType,
    @Args("orderBy", { nullable: true })
    orderBy: FeedOrderByInput
  ) {
    const _orderBy = orderBy
      ? orderBy[Object.keys(orderBy)[0]] === "desc"
        ? desc(schema.feeds[Object.keys(orderBy)[0]])
        : schema.feeds[Object.keys(orderBy)[0]]
      : desc(schema.feeds.updatedAt);

    const _feedType = !!feedType
      ? feedType === "post"
        ? ({
            post: true,
          } as const)
        : ({
            note: true,
          } as const)
      : ({
          post: true,
        } as const);

    return this.db.query.feeds.findMany({
      limit: take || undefined,
      offset: skip || undefined,
      where: (feeds, { eq }) => eq(feeds.type, feedType),
      orderBy: _orderBy,
      with: _feedType,
    });
  }
}

export default FeedResolver;

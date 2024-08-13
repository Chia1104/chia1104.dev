import { ObjectType, Field, ID } from "@nestjs/graphql";
import "reflect-metadata";

import { User } from "./user.model";

export enum FeedType {
  post = "post",
  note = "note",
}

@ObjectType()
export class Feed {
  @Field(() => ID)
  id: string;

  @Field()
  slug: string;

  @Field()
  title: string;

  @Field()
  excerpt: string;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;

  @Field(() => User)
  user: User;
}

import "reflect-metadata";
import { ObjectType, Field, ID, Int } from "@nestjs/graphql";
import { User } from "./user.model";

@ObjectType()
export class Post {
  @Field(() => ID)
  id: string;

  @Field()
  slug: string;

  @Field()
  title: string;

  @Field()
  excerpt: string;

  @Field(() => [String])
  tags: string[];

  @Field({ nullable: true })
  headImg?: string;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;

  @Field(() => Int, { nullable: true })
  readTime?: number;

  @Field({ nullable: true })
  readingMins?: string;

  @Field(() => Boolean, { nullable: true })
  published?: boolean;

  @Field()
  content: string;

  @Field(() => User)
  user: User;
}

import "reflect-metadata";
import { ObjectType, Field, ID } from "@nestjs/graphql";
import { Post } from "./post.model";

@ObjectType()
export class User {
  @Field(() => ID)
  id: string;

  @Field({ nullable: true })
  name?: string;

  @Field(() => ID, { nullable: true })
  email?: string;

  @Field(() => Date, { nullable: true })
  emailVerified?: Date;

  @Field({ nullable: true })
  image?: string;

  @Field(() => [Post], { nullable: true })
  posts?: Post[];
}

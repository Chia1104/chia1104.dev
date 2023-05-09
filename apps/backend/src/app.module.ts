import { Module } from "@nestjs/common";
import { GraphQLModule } from "@nestjs/graphql";
import { ApolloDriver, type ApolloDriverConfig } from "@nestjs/apollo";
import { ConfigModule } from "@nestjs/config";
import { join } from "path";
import { AppController } from "./app.controller";
import PostModule from "@/modules/post/post.module";

@Module({
  imports: [
    PostModule,
    ConfigModule.forRoot(),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), "schema.gql"),
      buildSchemaOptions: { dateScalarMode: "timestamp" },
      playground: true,
      introspection: process.env.NODE_ENV !== "production",
      persistedQueries: false,
    }),
  ],
  controllers: [AppController],
})
export class AppModule {}

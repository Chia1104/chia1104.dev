import { ApolloServerPluginLandingPageLocalDefault } from "@apollo/server/plugin/landingPage/default";
import type { ApolloDriverConfig } from "@nestjs/apollo";
import { ApolloDriver } from "@nestjs/apollo";
import { GraphQLModule } from "@nestjs/graphql";
import { join } from "path";

export default GraphQLModule.forRoot<ApolloDriverConfig>({
  driver: ApolloDriver,
  autoSchemaFile: join(process.cwd(), "src/schema.gql"),
  sortSchema: true,
  subscriptions: {
    "graphql-ws": true,
  },
  playground: false,
  introspection: true,
  plugins: [ApolloServerPluginLandingPageLocalDefault()],
});

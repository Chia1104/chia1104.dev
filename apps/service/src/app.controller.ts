import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

@ApiTags("Index")
@Controller()
export class AppController {
  @Get()
  async getProducts(): Promise<string> {
    return (
      "Welcome to the example NestJS app, please go to `/graphql` to use the GraphQL API or `/api/documentation` to use the Swagger API </br> And type </br>" +
      "<code>query GetProduct { getProducts { id name description } }</code>" +
      "</br/> to get the list of products"
    );
  }
}

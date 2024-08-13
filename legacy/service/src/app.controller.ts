import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

@ApiTags("Index")
@Controller()
export class AppController {
  @Get()
  getProducts() {
    return "Welcome to the example NestJS app, please go to `/graphql` to use the GraphQL API or `/api/documentation` to use the Swagger API";
  }
}

import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "./../src/app.module";

describe("AppController (e2e)", () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it("/ (GET)", () => {
    return request(app.getHttpServer())
      .get("/")
      .expect(200)
      .expect(
        "Welcome to the example NestJS app, please go to `/graphql` to use the GraphQL API or `/api/documentation` to use the Swagger API </br> And type </br>" +
          "<code>query GetProduct { getProducts { id name description } }</code>" +
          "</br/> to get the list of products"
      );
  });
});

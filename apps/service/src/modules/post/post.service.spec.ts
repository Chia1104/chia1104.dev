import { Test, TestingModule } from "@nestjs/testing";
import { schema } from "@chia/db";
import PostService from "@/modules/post/post.service";
import { describe, it, expect, beforeEach } from "vitest";

describe("PostService", () => {
  let service: PostService;
  let model: schema.Feed;

  it("should be defined", () => {
    expect(PostService).toBeDefined();
  });
});

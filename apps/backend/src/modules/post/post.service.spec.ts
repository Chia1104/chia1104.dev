import { Test, TestingModule } from "@nestjs/testing";
import { Post } from "db";
import PostService from "@/modules/post/post.service";
import { describe, it, expect, beforeEach } from "vitest";

describe("PostService", () => {
  let service: PostService;
  let model: Post;

  it("should be defined", () => {
    expect(PostService).toBeDefined();
  });
});

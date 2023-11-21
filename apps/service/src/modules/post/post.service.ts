import { Injectable, Inject } from "@nestjs/common";
import { DRIZZLE_PROVIDER } from "../drizzle/drizzle.provider";
import { type DB, desc, schema } from "@chia/db";

@Injectable()
class PostService {
  constructor(@Inject(DRIZZLE_PROVIDER) private readonly db: DB) {}

  async getAllPosts() {
    return this.db.query.posts.findMany({
      orderBy: desc(schema.feeds.updatedAt),
      with: {
        feeds: {
          with: {
            posts: true,
          },
        },
      },
    });
  }
}

export default PostService;

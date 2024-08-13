import { Injectable, Inject } from "@nestjs/common";

import type { DB } from "@chia/db";

import { QueryFeedsDto } from "@/shared/dto/feeds.dto";
import { FeedType } from "@/shared/models/feed.model";

import { DRIZZLE_PROVIDER } from "../drizzle/drizzle.provider";

@Injectable()
class FeedService {
  constructor(@Inject(DRIZZLE_PROVIDER) private readonly db: DB) {}

  async getAll(dto?: QueryFeedsDto) {
    const orderBy = dto?.orderBy ?? "updatedAt";
    return this.db.query.feeds.findMany({
      orderBy: (feeds, { asc, desc }) => [
        dto?.sortOrder === "asc" ? asc(feeds[orderBy]) : desc(feeds[orderBy]),
      ],
      where: (feeds, { eq }) => eq(feeds.type, dto?.type ?? FeedType.post),
      limit: dto?.take ? Number(dto.take) : undefined,
      offset: dto?.skip ? Number(dto.skip) : undefined,
      with: {
        post: dto?.type === FeedType.post ? true : undefined,
        note: dto?.type === FeedType.note ? true : undefined,
        feedsToTags: {
          with: {
            tag: {
              columns: {
                slug: true,
                name: true,
              },
            },
          },
        },
      },
    });
  }
}

export default FeedService;

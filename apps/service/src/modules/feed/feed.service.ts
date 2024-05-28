import { Injectable, Inject } from "@nestjs/common";
import { DRIZZLE_PROVIDER } from "../drizzle/drizzle.provider";
import type { DB } from "@chia/db";
import { QueryFeedsDto } from "@/shared/dto/feeds.dto";
import { FeedType } from "@/shared/models/feed.model";

@Injectable()
class FeedService {
  constructor(@Inject(DRIZZLE_PROVIDER) private readonly db: DB) {}

  async getAll(dto?: QueryFeedsDto) {
    const feedType =
      dto?.type === FeedType.post
        ? ({
            post: true,
          } as const)
        : ({
            note: true,
          } as const);
    const orderBy = dto?.orderBy ?? "updatedAt";
    return this.db.query.feeds.findMany({
      orderBy: (feeds, { asc, desc }) => [
        dto?.sortOrder === "asc" ? asc(feeds[orderBy]) : desc(feeds[orderBy]),
      ],
      where: (feeds, { eq }) => eq(feeds.type, dto?.type ?? FeedType.post),
      limit: dto?.take ? Number(dto.take) : undefined,
      offset: dto?.skip ? Number(dto.skip) : undefined,
      with: feedType,
    });
  }
}

export default FeedService;

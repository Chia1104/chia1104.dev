import { Injectable, Inject } from "@nestjs/common";
import { DRIZZLE_PROVIDER } from "../drizzle/drizzle.provider";
import { type DB } from "@chia/db";
import { QueryFeedsDto } from "@/shared/dto/feeds.dto";

@Injectable()
class FeedService {
  constructor(@Inject(DRIZZLE_PROVIDER) private readonly db: DB) {}

  async getAll(dto?: QueryFeedsDto) {
    const feedType =
      dto.type === "post"
        ? ({
            post: true,
          } as const)
        : ({
            note: true,
          } as const);
    return this.db.query.feeds.findMany({
      orderBy: (feeds, { asc, desc }) => [
        dto.sortOrder === "asc"
          ? asc(feeds[dto.orderBy])
          : desc(feeds[dto.orderBy]),
      ],
      where: (feeds, { eq }) => eq(feeds.type, dto.type),
      limit: dto.take,
      offset: dto.skip,
      with: feedType,
    });
  }
}

export default FeedService;

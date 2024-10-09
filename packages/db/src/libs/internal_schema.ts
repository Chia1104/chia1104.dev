import { pgTable } from "../schema/table";
import { baseFeedsColumns, baseFeedsExtraConfig } from "./schema-columns";

/**
 * @description Feed table without embedding
 * **ONLY FOR INTERNAL USE !!!**
 */
export const internal_feedsOmitEmbedding = pgTable(
  "feed",
  baseFeedsColumns,
  baseFeedsExtraConfig
);

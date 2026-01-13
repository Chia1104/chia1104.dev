import { connectDatabase } from "@chia/db/client";

export const connectDatabaseStep = async () => {
  "use step";
  return await connectDatabase();
};

import VideoList from "./video-list";
import { getAllVideos } from "@/helpers/api/youtube";

export default async function Page() {
  const youtubeData = await getAllVideos(4);
  return <VideoList item={youtubeData.data.items} />;
}

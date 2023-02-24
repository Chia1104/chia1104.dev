import { type FC } from "react";
import type { YoutubeItem } from "@chia/shared/types";

interface Props {
  item: YoutubeItem;
}

const LastestVideo: FC<Props> = ({ item }) => {
  const id = item.snippet.resourceId.videoId;
  const name = item.snippet.title;

  return (
    <div className="flex w-full flex-col items-center justify-center">
      <a
        className="subtitle c-link mb-5 text-info"
        href={`https://www.youtube.com/watch?v=${id}`}
        target="_blank"
        rel="noreferrer"
        aria-label={"Open Youtube"}>
        {name}
      </a>
      <div className="mx-auto h-[270px] w-full overflow-hidden rounded-lg border-0 shadow-lg sm:h-[300px] sm:w-[500px]">
        <iframe
          className="h-full w-full"
          src={`https://www.youtube.com/embed/${id}`}
          loading="lazy"
          title={name}
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  );
};

export default LastestVideo;

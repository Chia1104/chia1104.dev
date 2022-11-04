import { type FC } from "react";
import type { YoutubeItem } from "@chia/shared/types";

interface Props {
  item: YoutubeItem;
}

const LastestVideo: FC<Props> = ({ item }) => {
  const id = item.snippet.resourceId.videoId;
  const name = item.snippet.title;

  return (
    <div className="w-full flex flex-col justify-center items-center">
      <a
        className="text-info subtitle mb-5 c-link"
        href={`https://www.youtube.com/watch?v=${id}`}
        target="_blank"
        rel="noreferrer"
        aria-label={"Open Youtube"}>
        {name}
      </a>
      <div className="w-full h-[270px] sm:h-[300px] sm:w-[500px] border-0 rounded-lg shadow-lg overflow-hidden mx-auto">
        <iframe
          className="w-full h-full"
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

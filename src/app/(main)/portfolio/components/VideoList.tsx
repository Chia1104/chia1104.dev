import { type FC } from "react";
import type { YoutubeItem } from "@chia/shared/types";
import LastestVideo from "./LastestVideo";
import dayjs from "dayjs";

interface Props {
  item: YoutubeItem[];
}

const VideoList: FC<Props> = ({ item }) => {
  return (
    <div className="grid w-full grid-cols-1 gap-3 xl:grid-cols-2">
      <LastestVideo item={item[0]} />
      <div className="my-5">
        {item.map(
          (v, i) =>
            i !== 0 && (
              <div
                key={v.id}
                className="c-border-primary flex h-[130px] w-full flex-col border-b-2 p-3">
                <a
                  className="mb-3 self-start"
                  href={`https://www.youtube.com/watch?v=${v.snippet.resourceId.videoId}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={"Open Youtube"}>
                  <header className="subtitle c-link text-info line-clamp-1">
                    {v.snippet.title}
                  </header>
                </a>
                <p className="c-description text-base line-clamp-1">
                  {v.snippet.description}
                </p>
                <p className="c-description mt-auto text-base">
                  {dayjs(v.snippet.publishedAt).format("MMMM D, YYYY")}
                </p>
              </div>
            )
        )}
      </div>
    </div>
  );
};

export default VideoList;

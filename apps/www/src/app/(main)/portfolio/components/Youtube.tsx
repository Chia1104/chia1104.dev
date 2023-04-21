import VideoList from "./VideoList.tsx";
import { Chia } from "@/shared/meta/chia.ts";
import { asyncComponent } from "@/utils/asyncComponent.util.ts";
import { type FC } from "react";
import type { Youtube as Y } from "@/shared/types/index.ts";
import { getAllVideos } from "@/helpers/api/youtube.ts";

interface Props {
  data?: {
    status: number;
    data: Y;
  };
}

const Youtube: FC<Props> = asyncComponent(async ({ data }) => {
  const YOUTUBE_URL = Chia.link.youtube_playlist;
  try {
    const youtubeData = data ? data : await getAllVideos(4);
    return (
      <div className="flex w-full flex-col">
        {youtubeData.status === 200 ? (
          <VideoList item={youtubeData.data.items} />
        ) : (
          <p className="c-description pb-5 indent-4">
            Sorry, I can't get my Youtube videos now. Please try again later.
          </p>
        )}
        <a
          href={YOUTUBE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:bg-secondary hover:dark:bg-primary group relative mt-7 inline-flex self-center rounded transition ease-in-out"
          aria-label="Open Youtube">
          <span className="c-button-secondary text-base after:content-['_↗'] group-hover:-translate-x-1 group-hover:-translate-y-1">
            Youtube
          </span>
        </a>
      </div>
    );
  } catch (error) {
    console.error(error);
    return (
      <div className="flex w-full flex-col">
        <p className="c-description pb-5 indent-4">
          Sorry, I can't get my Youtube videos now. Please try again later.
        </p>
        <a
          href={YOUTUBE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:bg-secondary hover:dark:bg-primary group relative mt-7 inline-flex self-center rounded transition ease-in-out"
          aria-label="Open Youtube">
          <span className="c-button-secondary text-base after:content-['_↗'] group-hover:-translate-x-1 group-hover:-translate-y-1">
            Youtube
          </span>
        </a>
      </div>
    );
  }
});

export default Youtube;

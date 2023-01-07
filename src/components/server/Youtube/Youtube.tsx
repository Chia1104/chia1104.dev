import VideoList from "./VideoList";
import { Chia } from "@chia/shared/meta/chia";
import { asyncComponent } from "@chia/utils/asyncComponent.util";
import { FC } from "react";
import { getAllVideos } from "@chia/helpers/api/youtube";

const Youtube: FC = asyncComponent(async () => {
  const YOUTUBE_URL = Chia.link.youtube_playlist;
  try {
    const { status, data } = await getAllVideos(4);
    return (
      <div className="w-full flex flex-col">
        {status === 200 ? (
          <VideoList item={data.items} />
        ) : (
          <p className="c-description pb-5 indent-4">
            Sorry, I can't get my Youtube videos now. Please try again later.
          </p>
        )}
        <a
          href={YOUTUBE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="group hover:bg-secondary hover:dark:bg-primary relative inline-flex transition ease-in-out rounded mt-7 self-center"
          aria-label={"Open Youtube"}>
          <span className="c-button-secondary transform group-hover:-translate-x-1 group-hover:-translate-y-1 text-base after:content-['_↗']">
            Youtube
          </span>
        </a>
      </div>
    );
  } catch (error) {
    console.error(error);
    return (
      <div className="w-full flex flex-col">
        <p className="c-description pb-5 indent-4">
          Sorry, I can't get my Youtube videos now. Please try again later.
        </p>
        <a
          href={YOUTUBE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="group hover:bg-secondary hover:dark:bg-primary relative inline-flex transition ease-in-out rounded mt-7 self-center"
          aria-label={"Open Youtube"}>
          <span className="c-button-secondary transform group-hover:-translate-x-1 group-hover:-translate-y-1 text-base after:content-['_↗']">
            Youtube
          </span>
        </a>
      </div>
    );
  }
});

export default Youtube;

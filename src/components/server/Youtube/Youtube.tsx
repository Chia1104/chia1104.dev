import VideoList from "./VideoList";
import type { Youtube as Y } from "@chia/shared/types";
import { Chia } from "@chia/shared/meta/chia";
import { getBaseUrl } from "@chia/utils/getBaseUrl";
import { asyncComponent } from "@chia/utils/asyncComponent.util";
import { FC } from "react";

const Youtube: FC = asyncComponent(async () => {
  const youtube = (await fetch(`${getBaseUrl()}/api/youtube`, {
    cache: "no-store",
  }).then((res) => res.json())) as Y;

  const YOUTUBE_URL = Chia.link.youtube_playlist;

  return (
    <>
      <div className="w-full flex flex-col">
        <VideoList item={youtube.items} />
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
    </>
  );
});

export default Youtube;

import { VideoLoader, ReposLoader } from "@chia/components/server";
import { Page } from "@chia/components/client";

const Loading = () => {
  return (
    <Page>
      <div className="main c-container">
        <div className="title sm:self-start pt-10">
          <span className="c-text-bg-sec-half dark:c-text-bg-primary-half">
            GitHub Repositories
          </span>
        </div>
        <p className="c-description sm:self-start pb-7">
          What I currently work on
        </p>
        <ReposLoader />
        <hr className="my-10 c-border-primary border-t-2 w-full" />
        <p className="title sm:self-start c-text-bg-sec-half dark:c-text-bg-primary-half">
          Youtube Playlists
        </p>
        <p className="c-description sm:self-start pb-7">
          I have created a few video for my Youtube channel.
        </p>
        <VideoLoader />
        <hr className="my-10 c-border-primary border-t-2 w-full" />
        <p className="title sm:self-start c-text-bg-sec-half dark:c-text-bg-primary-half">
          Design
        </p>
        <p className="c-description sm:self-start pb-7">
          Some of my design work
        </p>
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-10 px-10">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((item) => (
            <div
              key={item}
              className="animate-pulse aspect-w-3 aspect-h-5 w-full overflow-hidden rounded-lg bg-gray-200 shadow-lg relative"
            />
          ))}
        </div>
      </div>
    </Page>
  );
};

export default Loading;

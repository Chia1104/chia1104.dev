import { VideoLoader } from "@chia/components/pages/portfolios/Youtube";
import { ReposLoader } from "@chia/components/pages/portfolios/GitHub";
import { Page } from "@chia/components/shared";

const Loading = () => {
  return (
    <Page>
      <article className="main c-container">
        <header className="title sm:self-start pt-10">
          <span className="c-text-bg-sec-half dark:c-text-bg-primary-half">
            GitHub Repositories
          </span>
        </header>
        <p className="c-description sm:self-start pb-7">
          What I currently work on
        </p>
        <ReposLoader />
        <hr className="my-10 c-border-primary border-t-2 w-full" />
        <header className="title sm:self-start c-text-bg-sec-half dark:c-text-bg-primary-half">
          Youtube Playlists
        </header>
        <p className="c-description sm:self-start pb-7">
          I have created a few video for my Youtube channel.
        </p>
        <VideoLoader />
        <hr className="my-10 c-border-primary border-t-2 w-full" />
      </article>
    </Page>
  );
};

export default Loading;

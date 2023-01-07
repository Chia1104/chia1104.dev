import { GitHub, Youtube, Design } from "@chia/components/server";
import { Design as DesignData } from "@chia/shared/meta/design";

export const revalidate = 60;

const PortfoliosPage = () => {
  return (
    <article className="main c-container">
      <header className="title sm:self-start pt-10">
        <span className="c-text-bg-sec-half dark:c-text-bg-primary-half">
          GitHub Repositories
        </span>
      </header>
      <p className="c-description sm:self-start pb-7">
        What I currently work on
      </p>
      <GitHub />
      <hr className="my-10 c-border-primary border-t-2 w-full" />
      <header className="title sm:self-start c-text-bg-sec-half dark:c-text-bg-primary-half">
        Youtube Playlists
      </header>
      <p className="c-description sm:self-start pb-7">
        I have created a few video for my Youtube channel.
      </p>
      <Youtube />
      <hr className="my-10 c-border-primary border-t-2 w-full" />
      <Design data={DesignData} />
    </article>
  );
};

export default PortfoliosPage;

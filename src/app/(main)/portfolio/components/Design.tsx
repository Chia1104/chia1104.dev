import { type FC } from "react";
import { Chia } from "@chia/shared/meta/chia";
import type { Design as D } from "@chia/shared/types";
import DMPoster from "./DMPoster";

interface Props {
  data: D[];
}

const DMPosterList: FC<Props> = ({ data }) => {
  return (
    <div className="grid w-full grid-cols-1 gap-10 px-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {data.map((item) => (
        <DMPoster url={item.imgUrl} key={item.id} />
      ))}
    </div>
  );
};

const Design: FC<Props> = ({ data }) => {
  const POSTER_URL = Chia.link.google_photos;

  return (
    <>
      <header className="title c-text-bg-sec-half dark:c-text-bg-primary-half sm:self-start">
        Design
      </header>
      <p className="c-description pb-7 sm:self-start">Some of my design work</p>
      <DMPosterList data={data} />
      <a
        href={POSTER_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="group relative mt-7 inline-flex self-center rounded transition ease-in-out hover:bg-secondary hover:dark:bg-primary"
        aria-label={"Open Google Photos"}>
        <span className="c-button-secondary transform text-base after:content-['_↗'] group-hover:-translate-x-1 group-hover:-translate-y-1">
          Google Photos
        </span>
      </a>
    </>
  );
};

export default Design;

import { type FC } from "react";
import DMPosterList from "./DMPosterList";
import { Chia } from "@chia/shared/meta/chia";
import type { Design as D } from "@chia/shared/types";

interface Props {
  data: D[];
}

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

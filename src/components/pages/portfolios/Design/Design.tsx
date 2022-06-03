import { FC } from "react";
import { DMPosterList } from "@chia/components/pages/portfolios/Design/DMPosterList";

interface Props {
    data: string[];
}

export const Design: FC<Props> = ({ data }) => {
    return (
        <>
            <h1 className="title sm:self-start">
                Design
            </h1>
            <h2 className="c-description sm:self-start pb-5">
                Some of my design work
            </h2>
            <DMPosterList data={data} />
            <a
                href="https://photos.app.goo.gl/J1FobfgynJKW84Dm6"
                target="_blank"
                rel="noopener noreferrer"
                className="group hover:bg-primary relative inline-flex transition ease-in-out rounded mt-7 self-center"
                aria-label={'Open Google Photos'}
            >
                <span className="c-button-secondary transform group-hover:-translate-x-1 group-hover:-translate-y-1 text-base after:content-['_↗']">
                    Google Photos
                </span>
            </a>
        </>
    )
}

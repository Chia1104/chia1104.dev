import { type FC, memo } from "react";
import DMPosterList from "@chia/components/pages/portfolios/Design/DMPosterList";
import { Chia } from '@chia/utils/meta/chia';

interface Props {
    data: string[];
}

const Design: FC<Props> = ({ data }) => {
    const POSTER_URL = Chia.link.google_photos;

    return (
        <>
            <header className="title sm:self-start c-text-bg-sec-half dark:c-text-bg-primary-half">
                Design
            </header>
            <p className="c-description sm:self-start pb-7">
                Some of my design work
            </p>
            <DMPosterList data={data} />
            <a
                href={POSTER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="group hover:bg-secondary hover:dark:bg-primary relative inline-flex transition ease-in-out rounded mt-7 self-center"
                aria-label={'Open Google Photos'}
            >
                <span className="c-button-secondary transform group-hover:-translate-x-1 group-hover:-translate-y-1 text-base after:content-['_↗']">
                    Google Photos
                </span>
            </a>
        </>
    )
}

export default memo(Design, (prev, next) => prev.data === next.data)

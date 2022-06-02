import { FC } from "react";

interface Props {
    data?: string[];
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
        </>
    )
}

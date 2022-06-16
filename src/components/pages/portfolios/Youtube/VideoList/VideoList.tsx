import { FC } from 'react';
import type {YoutubeItem} from "@chia/utils/types/youtube";
import {LastestVideo} from "@chia/components/pages/portfolios/Youtube/LastestVideo";
import dayjs from "dayjs";

interface Props {
    item: YoutubeItem[]
}

export const VideoList: FC<Props> = ({ item }) => {
    return (
        <div className="w-full grid grid-cols-1 xl:grid-cols-2 gap-3">
            <LastestVideo item={item[0]} />
            <div className="my-5">
                {
                    item.map((v, i) => (
                        i !== 0 &&
                        <div key={v.id} className="w-full flex flex-col c-border-primary border-b-2 p-3 h-[130px]">
                            <a
                                className="mb-3"
                                href={`https://www.youtube.com/watch?v=${v.snippet.resourceId.videoId}`}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={"Open Youtube"}
                            >
                                <h2 className="text-info subtitle c-link line-clamp-1">
                                    {v.snippet.title}
                                </h2>
                            </a>
                            <p className="text-base line-clamp-1 c-description">
                                {v.snippet.description}
                            </p>
                            <p className="text-base mt-auto c-description">
                                {dayjs(v.snippet.publishedAt).format('MMMM D, YYYY')}
                            </p>
                        </div>
                    ))
                }
            </div>
        </div>
    )
}

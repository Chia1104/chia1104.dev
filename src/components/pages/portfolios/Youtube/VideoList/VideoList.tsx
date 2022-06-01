import { FC } from 'react';
import type {YoutubeItem} from "@chia/utils/types/youtube";
import {LastestVideo} from "@chia/components/pages/portfolios/Youtube/LastestVideo";

interface Props {
    videoData: YoutubeItem[]
}

export const VideoList: FC<Props> = ({ videoData }) => {
    return (
        <div className="w-full grid grid-cols-1 xl:grid-cols-2">
            {
                videoData && videoData.map((v, i) => (
                    i === 0 ? <LastestVideo /> : (
                        <div key={i} className="w-full flex flex-col c-border-primary border-b-2 p-5">
                            <h2 className="text-3xl pb-5">
                                {v.snippet.title}
                            </h2>
                            <h3 className="text-xl pb-5">
                                {v.snippet.description}
                            </h3>
                        </div>
                    )
                ))
            }
        </div>
    )
}

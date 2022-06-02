import { FC } from 'react';
import {VideoList} from "@chia/components/pages/portfolios/Youtube/VideoList";
import type {Youtube as y} from "@chia/utils/types/youtube";
import {VideoLoader} from "@chia/components/pages/portfolios/Youtube/VideoLoader";

interface Props {
    videoData: {
        status: number;
        data: y;
    }
    loading: 'idle' | 'pending' | 'succeeded' | 'failed';
    error?: string
}

export const Youtube: FC<Props> = ({ videoData, loading, error }) => {
    return (
        <>
            <h1 className="title sm:self-start">
                Youtube Playlists
            </h1>
            <h2 className="c-description sm:self-start pb-5">
                I have created a few video for my Youtube channel.
            </h2>
            {
                loading === 'pending' && <VideoLoader />
            }
            {
                loading === 'succeeded' && <VideoList item={videoData.data.items} />
            }
            {
                error || videoData.status !== 200 && <p>{error}</p>
            }
            <a
                href="https://www.youtube.com/playlist?list=PL7XkMe5ddX9Napk5747U6SIOAqWJBsqVM"
                target="_blank"
                rel="noopener noreferrer"
                className="group hover:bg-primary relative inline-flex transition ease-in-out rounded mt-7 self-center"
                aria-label={'Open Youtube'}
            >
                    <span className="c-button-secondary transform group-hover:-translate-x-1 group-hover:-translate-y-1 text-base after:content-['_↗']">
                        More
                    </span>
            </a>
        </>
    )
}

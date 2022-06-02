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
        </>
    )
}

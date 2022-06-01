import { FC } from 'react';
import {VideoList} from "@chia/components/pages/portfolios/Youtube/VideoList";
import type {Youtube as y} from "@chia/utils/types/youtube";

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
                loading === 'pending' && <p>Pending</p>
            }
            {
                loading === 'succeeded' && <VideoList item={videoData.data.items} />
            }
            {
                error && <p>{error}</p>
            }
        </>
    )
}

import { FC } from 'react';
import type {YoutubeItem} from "@chia/utils/types/youtube";

interface Props {
    item: YoutubeItem
}

export const LastestVideo: FC<Props> = ({ item }) => {
    const id = item.snippet.resourceId.videoId
    const name = item.snippet.title

    return (
        <div className="w-full h-[270px] sm:h-[300px] sm:w-[500px] border-0 rounded-lg shadow-lg overflow-hidden mx-auto">
            <iframe
                className="w-full h-full"
                src={`https://www.youtube.com/embed/${id}`}
                title={name}
                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
            />
        </div>
    )
}

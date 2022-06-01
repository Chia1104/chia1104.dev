import { FC } from 'react';

interface Props {
    videoSrc: string
    videoTitle: string
    videoDescription?: string
    videoCreatedAt?: string
}

export const LastestVideo: FC = () => {
    return (
        <div className="w-full h-[270px] sm:h-[300px] sm:w-[500px] border-0 rounded-lg shadow-lg overflow-hidden mx-auto">
            <iframe
                className="w-full h-full"
                src="https://www.youtube.com/embed/uYpbZr2lh_U"
                title="YouTube video player"
                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
            />
        </div>
    )
}

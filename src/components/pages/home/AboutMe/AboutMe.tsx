import Image from '@chia/components/globals/Image';
import { type FC } from "react";
import { Chia } from "@chia/utils/meta/chia"

interface Props {
    avatarSrc: string
}

export const AboutMe: FC<Props> = ({avatarSrc}) => {
    const name = Chia.name
    const chineseName = Chia.chineseName
    const title = Chia.title

    return (
        <div className="flex flex-col md:flex-row px-3 justify-center z-20 mt-10">
            <div className="flex flex-col justify-end items-center md:items-end mb-5 md:pr-5">
                <h1
                    className="title text-sec-text dark:text-white">
                    {name} {chineseName}
                </h1>
                <h2 className="description c-text-green-to-purple">
                    {title.toUpperCase()}
                </h2>
            </div>
            <div className="flex justify-center items-center rounded-full w-[200px] h-[200px] overflow-hidden bg-gradient-to-r from-purple-400 to-pink-600 flex justify-center items-center self-center">
                <div className="rounded-full w-[195px] h-[195px] p-3 c-bg-secondary">
                    <Image
                        src={avatarSrc || '/favicon.ico'}
                        alt="Chia1104"
                        width={195}
                        height={195}
                        priority
                    />
                </div>
            </div>
        </div>
    )
}

import { FC } from 'react'
import Image from "next/image";
import { Chia } from "@/utils/meta/chia"

interface Props {
    avatarSrc: string
}

export const Resume: FC<Props> = ({avatarSrc}) => {
    const name = Chia.name
    const chineseName = Chia.chineseName
    const title = Chia.title
    const content = Chia.content
    const fullName = Chia.fullName

    return (
        <div className="flex flex-col w-full">
            <div className="flex w-full flex-col md:flex-row">
                <div className="md:w-[35%] w-full flex justify-center items-center">
                    <div className="w-[150px] h-[150px] rounded-full overflow-hidden c-border-primary border-2 flex justify-center items-center p-3">
                        <Image
                            src={avatarSrc || '/favicon.ico'}
                            alt="Chia1104"
                            width={145}
                            height={145}
                            priority
                            className="rounded-full mx-auto"
                        />
                    </div>
                </div>
                <div className="md:w-[75%] w-full flex flex-col justify-center items-center">
                    <h1 className="title">
                        {fullName} - {chineseName}
                    </h1>
                    <h2 className="text-lg">
                        {content}
                    </h2>
                </div>
            </div>
            <div>
                <h3>
                    {content}
                </h3>
            </div>
        </div>
    )
}

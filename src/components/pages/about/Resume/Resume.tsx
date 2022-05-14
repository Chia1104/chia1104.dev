import { FC } from 'react'
import Image from "next/image";
import { Chia } from "@/utils/meta/chia"
import {Experience} from "@/components/pages/about/Resume/Experience";
import {LanAndTools} from "@/components/pages/about/Resume/LanAndTools";

interface Props {
    avatarSrc: string
}

export const Resume: FC<Props> = ({avatarSrc}) => {
    const name = Chia.name
    const chineseName = Chia.chineseName
    const title = Chia.title
    const content = Chia.content
    const fullName = Chia.fullName
    const phone = Chia.phone
    const email = Chia.email

    return (
        <div className="flex flex-col w-full">
            <div className="flex w-full flex-col md:flex-row mb-10">
                <div className="md:w-[40%] w-full flex justify-center items-center">
                    <div className="w-[150px] h-[150px] rounded-full overflow-hidden c-border-primary border-2 flex justify-center items-center">
                        <Image
                            src={avatarSrc || '/favicon.ico'}
                            alt="Chia1104"
                            width={400}
                            height={300}
                            priority
                        />
                    </div>
                </div>
                <div className="md:w-[60%] w-full flex flex-col mt-10 md:mt-0">
                    <h1 className="title text-center md:text-left pb-5">
                        {name} - {chineseName}
                    </h1>
                    <h2 className="text-lg text-center md:text-left ">
                        {content}
                    </h2>
                </div>
            </div>
            <div className="w-full flex flex-col items-center">
                <button className="c-button-secondary mb-10">
                    Contact me
                </button>
                <div className="w-[85%] mt-10 lg:w-[55%]">
                    <ul className="c-description w-full">
                        <li className="mb-3 w-full flex">
                            <span className="w-[30%]">
                                Full Name:
                            </span>
                            <span className="w-[70%]">
                                {fullName} - {chineseName}
                            </span>
                        </li>
                        <li className="mb-3 w-full flex">
                            <span className="w-[30%]">
                                Title:
                            </span>
                            <span className="w-[70%]">
                                {title}
                            </span>
                        </li>
                        <li className="mb-3 w-full flex">
                            <span className="w-[30%]">
                                Phone:
                            </span>
                            <span className="w-[70%]">
                                {phone}
                            </span>
                        </li>
                        <li className="mb-3 w-full flex">
                            <span className="w-[30%]">
                                Email:
                            </span>
                            <span className="w-[70%]">
                                {email}
                            </span>
                        </li>
                    </ul>
                </div>
                <div className="mt-20 w-[60%]">
                    <LanAndTools/>
                </div>
                <div className="mt-20 w-full">
                    <Experience />
                </div>
            </div>
        </div>
    )
}

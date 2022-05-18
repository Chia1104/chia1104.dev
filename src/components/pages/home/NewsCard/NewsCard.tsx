import { FC } from 'react'
import NextLink from "next/link";

interface Props {
    title: string
    content: string
    subtitle: string
    link: string
}

export const NewsCard: FC<Props> = ({title, content, subtitle, link}) => {
    return (
        <div className="flex flex-col justify-center items-center">
            <h3 className="title c-text-secondary truncate">
                {title}
            </h3>
            <div className="lg:mx-5 c-bg-gradient-yellow-to-pink w-[350px] rounded-xl relative flex justify-center items-center min-h-[150px] mt-5">
                <div className="w-[343px] h-[143px] c-bg-secondary p-2 rounded-xl">
                    <p className="text-xl text-center">
                        { content }
                    </p>
                </div>
                <NextLink
                    href={link}
                >
                    <a className="c-bg-gradient-green-to-purple w-[85px] absolute top-[8rem] h-10 rounded-full flex justify-center items-center text-white hover:scale-[1.05] transition ease-in-out">
                        MORE
                    </a>
                </NextLink>
            </div>
        </div>
    )
}

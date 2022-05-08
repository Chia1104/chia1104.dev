import { motion } from "framer-motion";
import Image from 'next/image'
import { FC } from "react";

export const AboutMe: FC = () => {

    return (
        <div className="w-full h-full flex flex-col">
            <div className="flex flex-col xl:flex-row px-3 justify-center z-20">
                <div className="flex flex-col justify-end items-center xl:items-end mb-5 xl:pr-5">
                    <h1
                        className="title text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
                        Yu Chia, Yu
                    </h1>
                    <h2 className="description text-sec-text">
                        WEB DEVELOPER
                    </h2>
                </div>
                <div className="flex justify-center items-center">
                    <div className="rounded-full w-[200px] h-[200px] overflow-hidden bg-gradient-to-r from-purple-400 to-pink-600 flex justify-center items-center">
                        <div className="rounded-full w-[195px] h-[195px] bg-white p-3">
                            <Image
                                src="https://firebasestorage.googleapis.com/v0/b/chia1104.appspot.com/o/me-images%2Fme-memoji.PNG?alt=media&token=7ac17143-80b4-4246-9f42-baa95fd45ce1"
                                alt="Chia1104"
                                width={200}
                                height={200}
                                priority
                            />
                        </div>
                    </div>
                </div>
            </div>
            <div className="bg-gray-300 rounded-xl p-5 mt-20 w-[90%] mx-auto">
                <ul>
                    <li className="text-sec-text mb-2">
                        🔭 I’m currently working on: My personal website with NextJS
                    </li>
                    <li className="text-sec-text mb-2">
                        🌱 I’m currently learning: Docker, Next.js, Nest.js, TypeScript, Go
                    </li>
                    <li className="text-sec-text mb-2">
                        👯 I’m looking to collaborate on: Intern ship
                    </li>
                    <li className="text-sec-text mb-2">
                        📫 How to reach me: yuyuchia7423@gmail.com
                    </li>
                    <li className="text-sec-text">
                        ⚡ Fun fact:
                        <a href="https://open.spotify.com/user/21vnijzple4ufn2nzlfjy37py?si=b5f011d11a794ba4&nd=1" target="_blank" rel="noreferrer"> Spotify </a>
                        /
                        {/* eslint-disable-next-line react/no-unescaped-entities */}
                        <a href="https://skyline.github.com/Chia1104/2022" target="_blank" rel="noreferrer"> Chia1104's 2022 GitHub Skyline </a>
                    </li>
                </ul>
            </div>
        </div>
    )
}

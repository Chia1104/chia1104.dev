import { FC } from "react";
import {
    SiFirebase,
    SiJavascript,
    SiNextdotjs,
    SiPython,
    SiReact,
    SiJava,
    SiPhp,
    SiMysql,
    SiMongodb,
    SiNestjs,
    SiLaravel,
    SiVuedotjs,
    SiTailwindcss,
    SiDocker,
    SiGithubactions,
    SiGooglecloud,
    SiAdobephotoshop,
    SiAdobeillustrator,
    SiAdobepremierepro,
} from 'react-icons/si'

export const LanAndTools: FC = () => {
    return (
        <div className="w-full flex flex-col justify-center items-center">
            <h1 className="title pb-10 text-center">
                Languages and Tools
            </h1>
            <div className="grid grid-cols-1 lg:grid-cols-2 w-full">
                <div className="flex flex-col justify-center items-center lg:px-10">
                    <h2 className="text-3xl my-10 ">
                        Languages
                    </h2>
                    <div className="grid grid-cols-3 w-full c-description">
                        <SiJavascript className="w-[60px] h-[60px] my-5 mx-auto" />
                        <SiJava className="w-[60px] h-[60px] my-5 mx-auto" />
                        <SiPhp className="w-[60px] h-[60px] my-5 mx-auto" />
                        <SiPython className="w-[60px] h-[60px] my-5 mx-auto" />
                    </div>
                </div>
                <div className="flex flex-col justify-center items-center lg:px-10">
                    <h2 className="text-3xl my-10">
                        Frontend
                    </h2>
                    <div className="grid grid-cols-3 w-full c-description">
                        <SiReact className="w-[60px] h-[60px] my-5 mx-auto" />
                        <SiNextdotjs className="w-[60px] h-[60px] my-5 mx-auto" />
                        <SiVuedotjs className="w-[60px] h-[60px] my-5 mx-auto" />
                        <SiTailwindcss className="w-[60px] h-[60px] my-5 mx-auto" />
                    </div>
                </div>
                <div className="flex flex-col justify-center items-center lg:px-10">
                    <h2 className="text-3xl my-10 ">
                        Backend
                    </h2>
                    <div className="grid grid-cols-3 w-full c-description">
                        <SiLaravel className="w-[60px] h-[60px] my-5 mx-auto" />
                        <SiNestjs className="w-[60px] h-[60px] my-5 mx-auto" />
                    </div>
                </div>
                <div className="flex flex-col justify-center items-center lg:px-10">
                    <h2 className="text-3xl my-10 ">
                        Databases
                    </h2>
                    <div className="grid grid-cols-3 w-full c-description">
                        <SiMysql className="w-[60px] h-[60px] my-5 mx-auto" />
                        <SiMongodb className="w-[60px] h-[60px] my-5 mx-auto" />
                        <SiFirebase className="w-[60px] h-[60px] my-5 mx-auto" />
                    </div>
                </div>
                <div className="flex flex-col justify-center items-center lg:px-10">
                    <h2 className="text-3xl my-10 ">
                        Tools
                    </h2>
                    <div className="grid grid-cols-3 w-full c-description">
                        <SiDocker className="w-[60px] h-[60px] my-5 mx-auto" />
                        <SiGithubactions className="w-[60px] h-[60px] my-5 mx-auto" />
                        <SiGooglecloud className="w-[60px] h-[60px] my-5 mx-auto" />
                    </div>
                </div>
                <div className="flex flex-col justify-center items-center lg:px-10">
                    <h2 className="text-3xl my-10 ">
                        Slashie
                    </h2>
                    <div className="grid grid-cols-3 w-full c-description">
                        <SiAdobephotoshop className="w-[60px] h-[60px] my-5 mx-auto" />
                        <SiAdobeillustrator className="w-[60px] h-[60px] my-5 mx-auto" />
                        <SiAdobepremierepro className="w-[60px] h-[60px] my-5 mx-auto" />
                    </div>
                </div>
            </div>
        </div>
    )
}

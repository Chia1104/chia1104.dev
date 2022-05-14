import { FC } from "react";
import { SiFirebase, SiJavascript, SiNextdotjs, SiPython, SiReact, SiJava, SiPhp, SiMysql, SiMongodb, SiNestjs, SiLaravel, SiVuedotjs, SiTailwindcss } from 'react-icons/si'

export const LanAndTools: FC = () => {
    return (
        <div className="w-full flex flex-col">
            <h1 className="title pb-10 text-center">
                Languages and Tools
            </h1>
            <h2 className="text-2xl my-10">
                Languages
            </h2>
            <div className="grid grid-cols-3 w-full">
                <SiJavascript className="w-[60px] h-[60px] m-5" />
                <SiJava className="w-[60px] h-[60px] m-5" />
                <SiPhp className="w-[60px] h-[60px] m-5" />
                <SiPython className="w-[60px] h-[60px] m-5" />
            </div>
            <h2 className="text-2xl my-10">
                Frontend
            </h2>
            <div className="grid grid-cols-3 w-full">
                <SiReact className="w-[60px] h-[60px] m-5" />
                <SiNextdotjs className="w-[60px] h-[60px] m-5" />
                <SiVuedotjs className="w-[60px] h-[60px] m-5" />
                <SiTailwindcss className="w-[60px] h-[60px] m-5" />
            </div>
            <h2 className="text-2xl my-10">
                Backend
            </h2>
            <div className="grid grid-cols-3 w-full">
                <SiLaravel className="w-[60px] h-[60px] m-5" />
                <SiNestjs className="w-[60px] h-[60px] m-5" />
            </div>
            <h2 className="text-2xl my-10">
                Databases
            </h2>
            <div className="grid grid-cols-3 w-full">
                <SiMysql className="w-[60px] h-[60px] m-5" />
                <SiMongodb className="w-[60px] h-[60px] m-5" />
                <SiFirebase className="w-[60px] h-[60px] m-5" />
            </div>
        </div>
    )
}

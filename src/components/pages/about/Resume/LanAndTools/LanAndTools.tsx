import Link from "next/link";
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
import {LATList} from "@/components/pages/about/Resume/LanAndTools/LATList";

export const LanAndTools: FC = () => {
    return (
        <div className="w-full flex flex-col justify-center items-center">
            <h1 className="title pb-10 text-center">
                Languages and Tools
            </h1>
            <div className="grid grid-cols-1 lg:grid-cols-2 w-full">
                <LATList
                    category={'Languages'}
                >
                    <Link href="https://www.javascript.com/">
                        <a target='_blank' rel="noreferrer" className='w-full text-5xl flex justify-center items-center relative group my-5 mx-auto'>
                            <div className='transform group-hover:scale-110 rounded transition'>
                                <SiJavascript className="w-[60px] h-[60px]"/>
                            </div>
                            <div className='transform absolute text-sm p-2 c-bg-secondary scale-0 rounded top-16 transition duration-300 group-hover:scale-100 text-center'>
                                Javascript
                            </div>
                        </a>
                    </Link>
                    <Link href="https://www.java.com/">
                        <a target='_blank' rel="noreferrer" className='w-full text-5xl flex justify-center items-center relative group my-5 mx-auto'>
                            <div className='transform group-hover:scale-110 rounded transition'>
                                <SiJava className="w-[60px] h-[60px]"/>
                            </div>
                            <div className='transform absolute text-sm p-2 c-bg-secondary scale-0 rounded top-16 transition duration-300 group-hover:scale-100 text-center'>
                                Java
                            </div>
                        </a>
                    </Link>
                    <Link href="https://www.php.net/">
                        <a target='_blank' rel="noreferrer" className='w-full text-5xl flex justify-center items-center relative group my-5 mx-auto'>
                            <div className='transform group-hover:scale-110 rounded transition'>
                                <SiPhp className="w-[60px] h-[60px]"/>
                            </div>
                            <div className='transform absolute text-sm p-2 c-bg-secondary scale-0 rounded top-16 transition duration-300 group-hover:scale-100 text-center'>
                                PHP
                            </div>
                        </a>
                    </Link>
                    <Link href="https://www.python.org/">
                        <a target='_blank' rel="noreferrer" className='w-full text-5xl flex justify-center items-center relative group my-5 mx-auto'>
                            <div className='transform group-hover:scale-110 rounded transition'>
                                <SiPython className="w-[60px] h-[60px]"/>
                            </div>
                            <div className='transform absolute text-sm p-2 c-bg-secondary scale-0 rounded top-16 transition duration-300 group-hover:scale-100 text-center'>
                                Python
                            </div>
                        </a>
                    </Link>
                </LATList>
                <LATList category={'Frontend'}>
                    <Link href="https://reactjs.org/">
                        <a target='_blank' rel="noreferrer" className='w-full text-5xl flex justify-center items-center relative group my-5 mx-auto'>
                            <div className='transform group-hover:scale-110 rounded transition'>
                                <SiReact className="w-[60px] h-[60px]"/>
                            </div>
                            <div className='transform absolute text-sm p-2 c-bg-secondary scale-0 rounded top-16 transition duration-300 group-hover:scale-100 text-center'>
                                React.js
                            </div>
                        </a>
                    </Link>
                    <Link href="https://nextjs.org/">
                        <a target='_blank' rel="noreferrer" className='w-full text-5xl flex justify-center items-center relative group my-5 mx-auto'>
                            <div className='transform group-hover:scale-110 rounded transition'>
                                <SiNextdotjs className="w-[60px] h-[60px]"/>
                            </div>
                            <div className='transform absolute text-sm p-2 c-bg-secondary scale-0 rounded top-16 transition duration-300 group-hover:scale-100 text-center'>
                                Next.js
                            </div>
                        </a>
                    </Link>
                    <Link href="https://vuejs.org/">
                        <a target='_blank' rel="noreferrer" className='w-full text-5xl flex justify-center items-center relative group my-5 mx-auto'>
                            <div className='transform group-hover:scale-110 rounded transition'>
                                <SiVuedotjs className="w-[60px] h-[60px]"/>
                            </div>
                            <div className='transform absolute text-sm p-2 c-bg-secondary scale-0 rounded top-16 transition duration-300 group-hover:scale-100 text-center'>
                                Vue.js
                            </div>
                        </a>
                    </Link>
                    <Link href="https://tailwindcss.com/">
                        <a target='_blank' rel="noreferrer" className='w-full text-5xl flex justify-center items-center relative group my-5 mx-auto'>
                            <div className='transform group-hover:scale-110 rounded transition'>
                                <SiTailwindcss className="w-[60px] h-[60px]"/>
                            </div>
                            <div className='transform absolute text-sm p-2 c-bg-secondary scale-0 rounded top-16 transition duration-300 group-hover:scale-100 text-center'>
                                Tailwindcss
                            </div>
                        </a>
                    </Link>
                </LATList>
                <LATList category={'Backend'}>
                    <Link href="https://laravel.com/">
                        <a target='_blank' rel="noreferrer" className='w-full text-5xl flex justify-center items-center relative group my-5 mx-auto'>
                            <div className='transform group-hover:scale-110 rounded transition'>
                                <SiLaravel className="w-[60px] h-[60px]"/>
                            </div>
                            <div className='transform absolute text-sm p-2 c-bg-secondary scale-0 rounded top-16 transition duration-300 group-hover:scale-100 text-center'>
                                Laravel
                            </div>
                        </a>
                    </Link>
                    <Link href="https://nestjs.com/">
                        <a target='_blank' rel="noreferrer" className='w-full text-5xl flex justify-center items-center relative group my-5 mx-auto'>
                            <div className='transform group-hover:scale-110 rounded transition'>
                                <SiNestjs className="w-[60px] h-[60px]"/>
                            </div>
                            <div className='transform absolute text-sm p-2 c-bg-secondary scale-0 rounded top-16 transition duration-300 group-hover:scale-100 text-center'>
                                Nest.js
                            </div>
                        </a>
                    </Link>
                </LATList>
                <LATList category={'Databases'}>
                    <Link href="https://www.mysql.com/">
                        <a target='_blank' rel="noreferrer" className='w-full text-5xl flex justify-center items-center relative group my-5 mx-auto'>
                            <div className='transform group-hover:scale-110 rounded transition'>
                                <SiMysql className="w-[60px] h-[60px]"/>
                            </div>
                            <div className='transform absolute text-sm p-2 c-bg-secondary scale-0 rounded top-16 transition duration-300 group-hover:scale-100 text-center'>
                                MySQL
                            </div>
                        </a>
                    </Link>
                    <Link href="https://www.mongodb.com/">
                        <a target='_blank' rel="noreferrer" className='w-full text-5xl flex justify-center items-center relative group my-5 mx-auto'>
                            <div className='transform group-hover:scale-110 rounded transition'>
                                <SiMongodb className="w-[60px] h-[60px]"/>
                            </div>
                            <div className='transform absolute text-sm p-2 c-bg-secondary scale-0 rounded top-16 transition duration-300 group-hover:scale-100 text-center'>
                                MongoDB
                            </div>
                        </a>
                    </Link>
                    <Link href="https://firebase.google.com/">
                        <a target='_blank' rel="noreferrer" className='w-full text-5xl flex justify-center items-center relative group my-5 mx-auto'>
                            <div className='transform group-hover:scale-110 rounded transition'>
                                <SiFirebase className="w-[60px] h-[60px]"/>
                            </div>
                            <div className='transform absolute text-sm p-2 c-bg-secondary scale-0 rounded top-16 transition duration-300 group-hover:scale-100 text-center'>
                                Firebase
                            </div>
                        </a>
                    </Link>
                </LATList>
                <LATList category={'Tools'}>
                    <Link href="https://www.docker.com/">
                        <a target='_blank' rel="noreferrer" className='w-full text-5xl flex justify-center items-center relative group my-5 mx-auto'>
                            <div className='transform group-hover:scale-110 rounded transition'>
                                <SiDocker className="w-[60px] h-[60px]"/>
                            </div>
                            <div className='transform absolute text-sm p-2 c-bg-secondary scale-0 rounded top-16 transition duration-300 group-hover:scale-100 text-center'>
                                Docker
                            </div>
                        </a>
                    </Link>
                    <Link href="https://www.github.com">
                        <a target='_blank' rel="noreferrer" className='w-full text-5xl flex justify-center items-center relative group my-5 mx-auto'>
                            <div className='transform group-hover:scale-110 rounded transition'>
                                <SiGithubactions className="w-[60px] h-[60px]"/>
                            </div>
                            <div className='transform absolute text-sm p-2 c-bg-secondary scale-0 rounded top-16 transition duration-300 group-hover:scale-100 text-center'>
                                Github Actions
                            </div>
                        </a>
                    </Link>
                    <Link href="https://cloud.google.com/">
                        <a target='_blank' rel="noreferrer" className='w-full text-5xl flex justify-center items-center relative group my-5 mx-auto'>
                            <div className='transform group-hover:scale-110 rounded transition'>
                                <SiGooglecloud className="w-[60px] h-[60px]"/>
                            </div>
                            <div className='transform absolute text-sm p-2 c-bg-secondary scale-0 rounded top-16 transition duration-300 group-hover:scale-100 text-center'>
                                Google Cloud Platform
                            </div>
                        </a>
                    </Link>
                </LATList>
                <LATList category={'Slashie'}>
                    <Link href="https://www.adobe.com/tw/products/photoshop.html">
                        <a target='_blank' rel="noreferrer" className='w-full text-5xl flex justify-center items-center relative group my-5 mx-auto'>
                            <div className='transform group-hover:scale-110 rounded transition'>
                                <SiAdobephotoshop className="w-[60px] h-[60px]"/>
                            </div>
                            <div className='transform absolute text-sm p-2 c-bg-secondary scale-0 rounded top-16 transition duration-300 group-hover:scale-100 text-center '>
                                Photoshop
                            </div>
                        </a>
                    </Link>
                    <Link href="https://www.adobe.com/tw/products/illustrator.html">
                        <a target='_blank' rel="noreferrer" className='w-full text-5xl flex justify-center items-center relative group my-5 mx-auto'>
                            <div className='transform group-hover:scale-110 rounded transition'>
                                <SiAdobeillustrator className="w-[60px] h-[60px]"/>
                            </div>
                            <div className='transform absolute text-sm p-2 c-bg-secondary scale-0 rounded top-16 transition duration-300 group-hover:scale-100 text-center'>
                                Illustrator
                            </div>
                        </a>
                    </Link>
                    <Link href="https://www.adobe.com/tw/products/premiere.html">
                        <a target='_blank' rel="noreferrer" className='w-full text-5xl flex justify-center items-center relative group my-5 mx-auto'>
                            <div className='transform group-hover:scale-110 rounded transition'>
                                <SiAdobepremierepro className="w-[60px] h-[60px]"/>
                            </div>
                            <div className='transform absolute text-sm p-2 c-bg-secondary scale-0 rounded top-16 transition duration-300 group-hover:scale-100 text-center'>
                                Premiere Pro
                            </div>
                        </a>
                    </Link>
                </LATList>
            </div>
        </div>
    )
}

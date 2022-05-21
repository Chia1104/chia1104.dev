import { FC } from "react";
import {
    SiFirebase,
    SiJavascript,
    SiNextdotjs,
    SiPython,
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
import { LATItem } from "./LATList/LATItem";

export const LanAndTools: FC = () => {
    return (
        <div className="w-full flex flex-col justify-center items-center">
            <h1 className="title pb-10 text-center">
                Languages and Tools
            </h1>
            <div className="grid grid-cols-1 lg:grid-cols-2 w-full">
                <LATList category={'Languages'}>
                    <LATItem
                        href={'https://www.javascript.com/'}
                        name={'JavaScript'}
                    >
                        <SiJavascript className="w-[60px] h-[60px]"/>
                    </LATItem>
                    <LATItem
                        href={'https://www.java.com/'}
                        name={'Java'}
                    >
                        <SiJava className="w-[60px] h-[60px]"/>
                    </LATItem>
                    <LATItem
                        href={'https://www.php.net/'}
                        name={'PHP'}
                    >
                        <SiPhp className="w-[60px] h-[60px]"/>
                    </LATItem>
                    <LATItem
                        href={'https://www.python.org/'}
                        name={'Python'}
                    >
                        <SiPython className="w-[60px] h-[60px]"/>
                    </LATItem>
                </LATList>
                <LATList category={'Frontend'}>
                    <LATItem
                        href={'https://nextjs.org/'}
                        name={'NextJS'}
                    >
                        <SiNextdotjs className="w-[60px] h-[60px]"/>
                    </LATItem>
                    <LATItem
                        href={'https://vuejs.org/'}
                        name={'VueJS'}
                    >
                        <SiVuedotjs className="w-[60px] h-[60px]"/>
                    </LATItem>
                    <LATItem
                        href={'https://tailwindcss.com/'}
                        name={'Tailwindcss'}
                    >
                        <SiTailwindcss className="w-[60px] h-[60px]"/>
                    </LATItem>
                </LATList>
                <LATList category={'Backend'}>
                    <LATItem
                        href={'https://laravel.com/'}
                        name={'Laravel'}
                    >
                        <SiLaravel className="w-[60px] h-[60px]"/>
                    </LATItem>
                    <LATItem
                        href={'https://nestjs.com/'}
                        name={'NestJS'}
                    >
                        <SiNestjs className="w-[60px] h-[60px]"/>
                    </LATItem>
                </LATList>
                <LATList category={'Databases'}>
                    <LATItem
                        href={'https://www.mysql.com/'}
                        name={'MySQL'}
                    >
                        <SiMysql className="w-[60px] h-[60px]"/>
                    </LATItem>
                    <LATItem
                        href={'https://www.mongodb.com/'}
                        name={'MongoDB'}
                    >
                        <SiMongodb className="w-[60px] h-[60px]"/>
                    </LATItem>
                    <LATItem
                        href={'https://firebase.google.com/'}
                        name={'Firebase'}
                    >
                        <SiFirebase className="w-[60px] h-[60px]"/>
                    </LATItem>
                </LATList>
                <LATList category={'DevOps'}>
                    <LATItem
                        href={'https://www.docker.com/'}
                        name={'Docker'}
                    >
                        <SiDocker className="w-[60px] h-[60px]"/>
                    </LATItem>
                    <LATItem
                        href={'https://github.com/features/actions'}
                        name={'GitHub Action'}
                    >
                        <SiGithubactions className="w-[60px] h-[60px]"/>
                    </LATItem>
                    <LATItem
                        href={'https://cloud.google.com/'}
                        name={'GCP'}
                    >
                        <SiGooglecloud className="w-[60px] h-[60px]"/>
                    </LATItem>
                </LATList>
                <LATList category={'Design'}>
                    <LATItem
                        href={'https://www.adobe.com/tw/products/photoshop.html'}
                        name={'Photoshop'}
                    >
                        <SiAdobephotoshop className="w-[60px] h-[60px]"/>
                    </LATItem>
                    <LATItem
                        href={'https://www.adobe.com/tw/products/illustrator.html'}
                        name={'Illustrator'}
                    >
                        <SiAdobeillustrator className="w-[60px] h-[60px]"/>
                    </LATItem>
                    <LATItem
                        href={'https://www.adobe.com/tw/products/premiere.html'}
                        name={'Premiere Pro'}
                    >
                        <SiAdobepremierepro className="w-[60px] h-[60px]"/>
                    </LATItem>
                </LATList>
            </div>
        </div>
    )
}

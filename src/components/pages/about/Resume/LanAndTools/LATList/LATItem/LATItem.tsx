import React, { FC } from "react";
import Link from "next/link";
import { LAT } from "@/utils/types/lat";

interface Props {
    href: string;
    name: string;
    children: React.ReactNode,
    // lat: LAT
}

export const LATItem: FC<Props> = ({ href, children, name }) => {

    return (
        <Link href={href}>
            <a target='_blank' rel="noreferrer" className='w-full text-5xl flex justify-center items-center relative group my-5 mx-auto'>
                <div className='transform group-hover:scale-110 rounded transition'>
                    {children}
                </div>
                <div className='transform absolute text-sm p-2 c-bg-secondary scale-0 rounded top-[4.5rem] transition duration-300 group-hover:scale-100 text-center z-10'>
                    {name}
                </div>
            </a>
        </Link>
    )
}

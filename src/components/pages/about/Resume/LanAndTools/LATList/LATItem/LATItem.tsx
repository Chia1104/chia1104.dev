import { FC } from "react";
import Link from "next/link";
import { LAT } from "@/utils/types/lat";
import dynamic from 'next/dynamic'

interface Props {
    lat: LAT
}

export const LATItem: FC<Props> = ({ lat }) => {
    // const DynamicComponent = dynamic(() => import(lat.icon))

    return (
        <Link href={lat.link}>
            <a target='_blank' rel="noreferrer" className='w-full text-5xl flex justify-center items-center relative group my-5 mx-auto'>
                <div className='transform group-hover:scale-110 rounded transition'>
                    {/*<DynamicComponent />*/}
                </div>
                <div className='transform absolute text-sm p-2 c-bg-secondary scale-0 rounded top-16 transition duration-300 group-hover:scale-100 text-center'>
                    {lat.name}
                </div>
            </a>
        </Link>
    )
}

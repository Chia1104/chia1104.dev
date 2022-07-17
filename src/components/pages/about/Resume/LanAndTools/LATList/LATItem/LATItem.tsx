import { type FC } from "react";
import Link from "next/link";
import { type LAT } from "@chia/utils/types/lat";

interface Props {
    lat: LAT
}

export const LATItem: FC<Props> = ({lat }) => {

    const LATIcon = lat.icon.bind(null, { style: { fontSize: '1.2em' } })

    return (
        <Link href={lat.link}>
            <a target='_blank' rel="noreferrer" className='w-full text-5xl flex justify-center items-center relative group my-5 mx-auto'>
                <div className='p-2 group-hover:animate-pulse'>
                    <LATIcon/>
                </div>
                <div className='absolute text-sm p-2 c-bg-secondary scale-0 rounded top-[4.5rem] transition duration-300 group-hover:scale-100 text-center z-10'>
                    {lat.name}
                </div>
            </a>
        </Link>
    )
}

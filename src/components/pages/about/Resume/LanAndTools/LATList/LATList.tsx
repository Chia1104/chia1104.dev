import React, { FC } from "react";
import { LAT } from "@/utils/types/lat";
import {LATItem} from "@/components/pages/about/Resume/LanAndTools/LATList/LATItem";

interface Props {
    category: string,
    data: LAT
}

export const LATList: FC<Props> = ({category, data}) => {
    return (
        <div className="flex flex-col justify-center items-center lg:px-10">
            <h2 className="text-3xl my-10 ">
                {category}
            </h2>
            <div className="grid grid-cols-3 w-full c-description">
                {
                    // @ts-ignore
                    data.map((lat: LAT) => (
                        <LATItem
                            key={lat.name}
                            lat={lat}
                        />
                    ))
                }
            </div>
        </div>
    )
}

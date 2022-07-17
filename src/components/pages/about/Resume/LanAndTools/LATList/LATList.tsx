import { type FC } from "react";
import { type LAT } from "@chia/utils/types/lat";
import {LATItem} from "@chia/components/pages/about/Resume/LanAndTools/LATList/LATItem";

interface Props {
    category: string,
    data: LAT[]
}

export const LATList: FC<Props> = ({category, data}) => {
    return (
        <div className="flex flex-col justify-start items-center lg:px-10">
            <h2 className="subtitle my-10 ">
                {category}
            </h2>
            <div className="grid grid-cols-3 w-full c-description">
                {
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

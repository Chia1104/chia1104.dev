import React, { FC } from "react";
import { LAT } from "@/utils/types/lat";

interface Props {
    category: string,
    children: React.ReactNode,
}

export const LATList: FC<Props> = ({category, children}) => {
    return (
        <div className="flex flex-col justify-center items-center lg:px-10">
            <h2 className="text-3xl my-10 ">
                {category}
            </h2>
            <div className="grid grid-cols-3 w-full c-description">
               {/*<LATItem*/}
               {/*     lat={lat}*/}
               {/*/>*/}
                {children}
            </div>
        </div>
    )
}

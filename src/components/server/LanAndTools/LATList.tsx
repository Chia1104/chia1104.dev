import { type FC } from "react";
import { type LAT } from "@chia/shared/types";
import LATItem from "./LATItem";

interface Props {
  category: string;
  data: LAT[];
}

const LATList: FC<Props> = ({ category, data }) => {
  return (
    <div className="flex flex-col items-center justify-start lg:px-10">
      <h2 className="subtitle my-10 ">{category}</h2>
      <div className="c-description grid w-full grid-cols-3">
        {data.map((lat: LAT) => (
          <LATItem key={lat.name} lat={lat} />
        ))}
      </div>
    </div>
  );
};

export default LATList;

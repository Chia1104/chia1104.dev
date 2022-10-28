import { type FC } from "react";
import { type LAT } from "@chia/shared/types";

interface Props {
  lat: LAT;
}

const LATItem: FC<Props> = ({ lat }) => {
  const LATIcon = lat.icon.bind(null, { style: { fontSize: "1.2em" } });

  return (
    <a
      href={lat.link}
      target="_blank"
      rel="noreferrer"
      className="w-full text-5xl flex justify-center items-center relative group my-5 mx-auto">
      <div className="p-2 group-hover:animate-pulse">
        <LATIcon />
      </div>
      <div className="absolute text-sm p-2 c-bg-secondary scale-0 rounded top-[4.5rem] transition duration-300 group-hover:scale-100 text-center z-10">
        {lat.name}
      </div>
    </a>
  );
};

export default LATItem;

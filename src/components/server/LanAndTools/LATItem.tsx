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
      className="group relative my-5 mx-auto flex w-full items-center justify-center text-5xl">
      <div className="p-2 group-hover:animate-pulse">
        <LATIcon />
      </div>
      <div className="c-bg-secondary absolute top-[4.5rem] z-10 scale-0 rounded p-2 text-center text-sm transition duration-300 group-hover:scale-100">
        {lat.name}
      </div>
    </a>
  );
};

export default LATItem;

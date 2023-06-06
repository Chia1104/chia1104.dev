import { type FC } from "react";
import { type LAT } from "@/shared/types";
import { Chia } from "@/shared/meta/chia";

interface LATItemProps {
  lat: LAT;
}

interface LATListProps {
  category: string;
  data: LAT[];
}

const LATItem: FC<LATItemProps> = ({ lat }) => {
  const LATIcon = lat.icon.bind(null, { style: { fontSize: "1.2em" } });

  return (
    <a
      href={lat.link}
      target="_blank"
      rel="noreferrer"
      className="group relative mx-auto my-5 flex w-full items-center justify-center text-5xl">
      <div className="p-2 group-hover:animate-pulse">
        <LATIcon />
      </div>
      <div className="c-bg-secondary absolute top-[4.5rem] z-10 scale-0 rounded p-2 text-center text-sm transition duration-300 group-hover:scale-100">
        {lat.name}
      </div>
    </a>
  );
};

const LATList: FC<LATListProps> = ({ category, data }) => {
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

const LanAndTools: FC = () => {
  const d = Chia.technologies;

  return (
    <div className="flex w-full flex-col items-center justify-center">
      <h1 className="title pb-10 text-center">
        <span className="c-text-bg-sec-half dark:c-text-bg-primary-half">
          Languages and Tools
        </span>
      </h1>
      <div className="grid w-full grid-cols-1 gap-5 lg:grid-cols-2">
        <LATList category="Languages" data={d.languages} />
        <LATList category="Web Frameworks" data={d.web_frameworks} />
        <LATList category="Database" data={d.databases} />
        <LATList category="DevOps" data={d.devops} />
        <LATList category="Other Tools" data={d.other_tools} />
        <LATList category="Design" data={d.design} />
      </div>
    </div>
  );
};

export default LanAndTools;

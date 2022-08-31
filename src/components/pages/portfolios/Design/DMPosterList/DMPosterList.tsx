import { type FC, memo } from "react";
import DMPoster from "../DMPoster";

interface Props {
  data: string[];
}

const DMPosterList: FC<Props> = ({ data }) => {
  return (
    <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-10 px-10">
      {data.map((item: string, i) => (
        <DMPoster url={item} key={i} />
      ))}
    </div>
  );
};

export default memo(DMPosterList);

import { type FC } from "react";
import { DMPoster } from "@chia/components/client";
import type { Design as D } from "@chia/shared/types";

interface Props {
  data: D[];
}

const DMPosterList: FC<Props> = ({ data }) => {
  return (
    <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-10 px-10">
      {data.map((item) => (
        <DMPoster url={item.imgUrl} key={item.id} />
      ))}
    </div>
  );
};

export default DMPosterList;

import DMPoster from "./dm-poster";
import { Design as DesignData } from "@/shared/meta/design";

const DMPosterList = () => {
  return (
    <div className="grid w-full grid-cols-1 gap-10 px-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {DesignData.map((item) => (
        <DMPoster url={item.imgUrl} key={item.id} />
      ))}
    </div>
  );
};

export default DMPosterList;

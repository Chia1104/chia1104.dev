import { type FC } from "react";

const ReposLoader: FC = () => {
  return (
    <div className="grid w-full grid-cols-1 gap-10 md:grid-cols-2 xl:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          className="c-button-secondary flex h-[150px] w-full flex-col rounded">
          <div className="mb-2 h-5 animate-pulse rounded-full bg-[#dddddd] dark:bg-black" />
          <div className="line-clamp-2 h-16 animate-pulse rounded-lg bg-[#dddddd] dark:bg-black" />
          <div className="mt-auto flex">
            <span className="mr-5 h-3 w-10 animate-pulse rounded-full bg-[#dddddd] dark:bg-black" />
            <span className="mr-5 h-3 w-10 animate-pulse rounded-full bg-[#dddddd] dark:bg-black" />
            <span className="h-3 w-10 animate-pulse rounded-full bg-[#dddddd] dark:bg-black" />
          </div>
        </div>
      ))}
    </div>
  );
};

export default ReposLoader;

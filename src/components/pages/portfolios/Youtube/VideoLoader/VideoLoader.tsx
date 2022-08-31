import type { FC } from "react";

const VideoLoader: FC = () => {
  return (
    <div className="w-full grid grid-cols-1 xl:grid-cols-2 gap-3">
      <div className="w-full flex flex-col justify-center items-center">
        <div className="dark:bg-dark bg-white animate-pulse h-5 mb-5 " />
        <div className="dark:bg-dark bg-white animate-pulse w-full h-[270px] sm:h-[300px] sm:w-[500px] border-0 rounded-lg shadow-lg overflow-hidden mx-auto" />
      </div>
      <div className="my-5">
        <div className="w-full flex flex-col c-border-primary border-b-2 p-3 h-[130px]">
          <div className="dark:bg-dark bg-white animate-pulse h-5 mb-3" />
          <div className="dark:bg-dark bg-white animate-pulse h-12" />
          <div className="dark:bg-dark bg-white animate-pulse h-3 mt-auto w-40" />
        </div>
        <div className="w-full flex flex-col c-border-primary border-b-2 p-3 h-[130px]">
          <div className="dark:bg-dark bg-white animate-pulse h-5 mb-3" />
          <div className="dark:bg-dark bg-white animate-pulse h-12" />
          <div className="dark:bg-dark bg-white animate-pulse h-3 mt-auto w-40" />
        </div>
        <div className="w-full flex flex-col c-border-primary border-b-2 p-3 h-[130px]">
          <div className="dark:bg-dark bg-white animate-pulse h-5 mb-3" />
          <div className="dark:bg-dark bg-white animate-pulse h-12" />
          <div className="dark:bg-dark bg-white animate-pulse h-3 mt-auto w-40" />
        </div>
      </div>
    </div>
  );
};

export default VideoLoader;

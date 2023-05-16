import Skeleton from "./skeleton";

const Loading = () => {
  return (
    <div className="c-container main mt-24">
      <div className="flex w-full max-w-[560px] flex-col gap-5">
        <Skeleton />
      </div>
    </div>
  );
};

export default Loading;

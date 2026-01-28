import Skeleton from "@/components/feed/skeleton";

const Loading = () => {
  return (
    <div className="grid w-full grid-cols-1 gap-5 md:grid-cols-2">
      <Skeleton />
    </div>
  );
};

export default Loading;

import Skeleton from "@/components/feed/skeleton";

const Loading = () => {
  return (
    <div className="w-full grid gap-5 grid-cols-1 md:grid-cols-2">
      <Skeleton />
    </div>
  );
};

export default Loading;

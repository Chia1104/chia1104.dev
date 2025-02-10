import Skeleton from "@/components/feed/skeleton";

const Loading = () => {
  return (
    <div className="w-full">
      <h2 className="mb-10 text-4xl">Posts</h2>
      <div className="grid gap-5 grid-cols-1 md:grid-cols-2">
        <Skeleton />
      </div>
    </div>
  );
};

export default Loading;

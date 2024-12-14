import Card from "@chia/ui/card";

const LoadingCard = () => (
  <Card className="relative flex h-full min-h-[442px] flex-col">
    <div className="aspect-h-9 aspect-w-16 c-bg-primary not-prose w-full animate-pulse overflow-hidden rounded-t-3xl" />
    <div className="flex h-full flex-col p-4 pt-0">
      <div className="c-bg-primary mt-5 h-5 w-1/2 animate-pulse rounded-full" />
      <div className="c-bg-primary mt-2 h-4 w-1/4 animate-pulse rounded-full" />
      <div className="c-bg-primary mt-2 h-4 w-1/2 animate-pulse rounded-full" />
      <div className="mt-auto flex flex-wrap space-x-2">
        <span className="c-bg-primary h-4 w-1/4 animate-pulse rounded" />
      </div>
    </div>
  </Card>
);

export default function Loading() {
  return (
    <div className="grid w-full grid-cols-1 gap-10 md:grid-cols-2">
      <LoadingCard />
      <LoadingCard />
      <LoadingCard />
      <LoadingCard />
    </div>
  );
}

import { CHBot, ThinkingCHBot, FoldCHBot } from "@chia/ui/chbot";

export default function Page() {
  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="flex h-full w-full max-w-[50px] items-center justify-center">
        <CHBot />
      </div>
      <div className="flex h-full w-full max-w-[50px] items-center justify-center">
        <ThinkingCHBot />
      </div>
      <div className="flex h-full w-full max-w-[50px] items-center justify-center">
        <FoldCHBot />
      </div>
    </div>
  );
}

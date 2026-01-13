import { CHBot, ThinkingCHBot, FoldCHBot } from "@chia/ui/chbot";

export default function Page() {
  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="w-full h-full max-w-[50px] flex items-center justify-center">
        <CHBot />
      </div>
      <div className="w-full h-full max-w-[50px] flex items-center justify-center">
        <ThinkingCHBot />
      </div>
      <div className="w-full h-full max-w-[50px] flex items-center justify-center">
        <FoldCHBot />
      </div>
    </div>
  );
}

"use client";

import { Image, ImageZoom } from "@chia/ui";

export default function Error() {
  return (
    <div className="c-bg-third relative flex w-full flex-col items-center justify-center overflow-hidden rounded-lg p-3 px-5">
      <h3 className="my-2">這裡看起來有點無聊，晚點馬上為您準備好</h3>
      <ImageZoom>
        <div className="not-prose aspect-h-1 aspect-w-1 relative w-[100px]">
          <Image
            src="/memo.png"
            alt="memo"
            className="object-cover"
            fill
            loading="lazy"
          />
        </div>
      </ImageZoom>
      <div className="dark:c-bg-gradient-purple-to-pink c-bg-gradient-yellow-to-pink absolute -z-40 h-full w-full opacity-50 blur-3xl" />
    </div>
  );
}

"use client";

import { type FC } from "react";

interface MDXYoutubeProps {
  ytSrc: string;
  ytTitle: string;
}

const MDXYoutube: FC<MDXYoutubeProps> = ({ ytSrc, ytTitle }) => {
  return (
    <div className="mx-auto my-10 h-[300px] w-full max-w-[750px] overflow-hidden rounded-lg border-0 shadow-lg md:h-[400px] lg:h-[430px]">
      <iframe
        className="h-full w-full"
        src={ytSrc}
        title={ytTitle}
        loading="lazy"
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
};

export default MDXYoutube;
export type { MDXYoutubeProps };

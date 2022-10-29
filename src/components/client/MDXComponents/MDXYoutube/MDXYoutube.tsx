"use client";

import { type FC } from "react";

interface Props {
  ytSrc: string;
  ytTitle: string;
}

const MDXYoutube: FC<Props> = ({ ytSrc, ytTitle }) => {
  return (
    <div className="w-full h-[300px] md:h-[400px] lg:h-[430px] max-w-[750px] border-0 rounded-lg shadow-lg overflow-hidden mx-auto my-10">
      <iframe
        className="w-full h-full"
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

"use client";

import { type FC, useRef, useState, memo } from "react";
import { useHover } from "usehooks-ts";
import { Image, Modal } from "@chia/ui";
import { cn } from "@chia//utils/cn.util";

interface Props {
  url: string;
}

const DMPoster: FC<Props> = ({ url }) => {
  const r = useRef(null);
  const isHover = useHover(r);
  const [isShow, setIsShow] = useState(false);

  const handleClose = () => setIsShow(false);

  return (
    <div
      className="group aspect-w-3 aspect-h-5 relative w-full overflow-hidden rounded-lg bg-gray-200 shadow-lg"
      ref={r}>
      <Image
        src={url || "/posts/example-posts/example.jpg"}
        alt={"DMPoster"}
        className={cn(
          "rounded object-cover transition duration-200 ease-in-out group-hover:scale-[1.05] group-hover:cursor-zoom-in"
        )}
        loading="lazy"
        fill
        sizes="(max-width: 768px) 100vw,
               (max-width: 1200px) 50vw,
               33vw"
        quality={100}
        onClick={() => setIsShow(!isShow)}
      />
      <Modal
        isShowed={isShow}
        activeModal={handleClose}
        className="w-full max-w-lg md:max-w-xl lg:max-w-2xl xl:max-w-3xl">
        <div className="aspect-w-1 aspect-h-1 w-full">
          <Image
            blur={false}
            src={url || "/posts/example-posts/example.jpg"}
            alt={"DMPoster"}
            loading="lazy"
            className="object-contain"
            fill
            sizes="(max-width: 768px) 100vw,
                   (max-width: 1200px) 50vw,
                   33vw"
            quality={100}
          />
        </div>
      </Modal>
    </div>
  );
};

export default memo(DMPoster, (prev, next) => prev.url === next.url);

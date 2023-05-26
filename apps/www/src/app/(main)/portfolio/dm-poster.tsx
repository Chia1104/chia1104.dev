"use client";

import { type FC, useState, memo } from "react";
import { Image, Modal, cn } from "ui";

interface Props {
  url: string;
}

const DmPoster: FC<Props> = ({ url }) => {
  const [isShow, setIsShow] = useState(false);

  const handleClose = () => setIsShow(false);

  return (
    <div className="aspect-h-5 aspect-w-3 group relative w-full overflow-hidden rounded-lg bg-gray-200 shadow-lg">
      <Image
        src={url || "/posts/example-posts/example.jpg"}
        alt="DMPoster"
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
        <div className="aspect-h-1 aspect-w-1 w-full">
          <Image
            blur={false}
            src={url || "/posts/example-posts/example.jpg"}
            alt="DMPoster"
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

export default memo(DmPoster, (prev, next) => prev.url === next.url);

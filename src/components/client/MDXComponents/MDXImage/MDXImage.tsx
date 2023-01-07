"use client";

import { Image, Modal } from "@chia/components/client";
import { type ImageProps } from "next/image";
import { type FC, DetailedHTMLProps, ImgHTMLAttributes, useState } from "react";
import cx from "classnames";

interface MDXImageProps extends ImageProps {
  alt: string;
  showAlt?: boolean;
  aspectRatio?: string;
  objectFit?: "contain" | "cover" | "fill" | "none" | "scale-down";
}

export const MDXImage: FC<
  MDXImageProps &
    DetailedHTMLProps<ImgHTMLAttributes<HTMLImageElement>, HTMLImageElement>
> = (MDXImageProps) => {
  const {
    alt,
    showAlt = true,
    aspectRatio = "2:1",
    objectFit = "cover",
    ...rest
  } = MDXImageProps;
  const [isShow, setIsShow] = useState(false);
  const handleClose = () => setIsShow(false);

  return (
    <div className="flex flex-col justify-center items-center my-5">
      <div
        className={cx(
          "w-full overflow-hidden rounded-lg bg-gray-200 shadow-lg",
          aspectRatio === "2:1" && "aspect-w-2 aspect-h-1",
          aspectRatio === "3:2" && "aspect-w-3 aspect-h-2",
          aspectRatio === "4:3" && "aspect-w-4 aspect-h-3",
          aspectRatio === "16:9" && "aspect-w-16 aspect-h-9",
          aspectRatio === "1:1" && "aspect-w-1 aspect-h-1",
          aspectRatio === "1:2" && "aspect-w-1 aspect-h-2",
          aspectRatio === "2:3" && "aspect-w-2 aspect-h-3",
          aspectRatio === "3:4" && "aspect-w-3 aspect-h-4",
          aspectRatio === "9:16" && "aspect-w-9 aspect-h-16"
        )}>
        <Image
          className={cx(
            "rounded-lg hover:scale-[1.03] duration-300 transition ease-in-out hover:cursor-zoom-in",
            objectFit && `object-${objectFit}`
          )}
          loading="lazy"
          fill
          sizes="(max-width: 768px) 100vw,
                 (max-width: 1200px) 50vw,
                 33vw"
          quality={100}
          {...rest}
          alt={alt}
          onClick={() => setIsShow(!isShow)}
        />
      </div>
      <Modal
        isShowed={isShow}
        activeModal={handleClose}
        className="w-full max-w-lg md:max-w-xl lg:max-w-2xl xl:max-w-3xl">
        <div className="w-full aspect-w-1 aspect-h-1">
          <Image
            blur={false}
            alt={alt}
            loading="lazy"
            className="object-contain"
            fill
            sizes="(max-width: 768px) 100vw,
                   (max-width: 1200px) 50vw,
                   33vw"
            quality={100}
            {...rest}
          />
        </div>
      </Modal>
      {showAlt && <p className="self-center mt-2">{alt}</p>}
    </div>
  );
};

"use client";

import Image from "../../Image";
import type { ComponentPropsWithRef, FC } from "react";
import { cn } from "../../utils/cn.util";

interface MDXImageProps extends ComponentPropsWithRef<typeof Image> {
  alt: string;
  showAlt?: boolean;
  aspectRatio?: string;
  objectFit?: "contain" | "cover" | "fill" | "none" | "scale-down";
}

export const MDXImage: FC<MDXImageProps> = (MDXImageProps) => {
  const {
    alt,
    showAlt = true,
    aspectRatio = "2:1",
    objectFit = "cover",
    ...rest
  } = MDXImageProps;
  return (
    <div className="my-5 flex flex-col items-center justify-center">
      <div
        className={cn(
          "w-full overflow-hidden rounded-lg bg-gray-200 shadow-lg",
          aspectRatio === "2:1" && "aspect-h-1 aspect-w-2",
          aspectRatio === "3:2" && "aspect-h-2 aspect-w-3",
          aspectRatio === "4:3" && "aspect-h-3 aspect-w-4",
          aspectRatio === "16:9" && "aspect-h-9 aspect-w-16",
          aspectRatio === "1:1" && "aspect-h-1 aspect-w-1",
          aspectRatio === "1:2" && "aspect-h-2 aspect-w-1",
          aspectRatio === "2:3" && "aspect-h-3 aspect-w-2",
          aspectRatio === "3:4" && "aspect-h-4 aspect-w-3",
          aspectRatio === "9:16" && "aspect-h-16 aspect-w-9"
        )}>
        <Image
          className={cn(
            "rounded-lg transition duration-300 ease-in-out hover:scale-[1.03] hover:cursor-zoom-in",
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
        />
      </div>
      {showAlt && <p className="mt-2 self-center">{alt}</p>}
    </div>
  );
};

"use client";

import { type FC, useState } from "react";
import NextImage, { type ImageProps as NextImageProps } from "next/image";
import { cn } from "@chia/utils/cn.util";

export interface ImageProps extends NextImageProps {
  blur?: boolean;
}

const Image: FC<ImageProps> = (props) => {
  const { alt, className, blur, ...rest } = props;
  const [isLoading, setLoading] = useState<boolean>(blur ?? true);
  return (
    <NextImage
      alt={alt}
      aria-label={alt}
      className={cn(
        className,
        "duration-700 ease-in-out",
        isLoading
          ? "scale-110 blur-2xl grayscale"
          : "scale-100 blur-0 grayscale-0"
      )}
      onLoadingComplete={() => setLoading(false)}
      {...rest}
    />
  );
};

export default Image;

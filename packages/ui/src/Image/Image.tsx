"use client";

import { type FC, useState } from "react";
import NextImage, { type ImageProps as NextImageProps } from "next/image";
import { cn } from "../utils/cn.util";

export interface ImageProps extends NextImageProps {
  blur?: boolean;
}

const Image: FC<ImageProps> = (props) => {
  const { alt, className, blur = true, ...rest } = props;
  const [isLoading, setLoading] = useState<boolean>(blur);
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
      onLoad={() => setLoading(false)}
      {...rest}
    />
  );
};

export default Image;

"use client";

import { type FC, useState, forwardRef, type Ref } from "react";
import NextImage, { type ImageProps as NextImageProps } from "next/image";
import { cn } from "../utils/cn.util";

export interface ImageProps extends NextImageProps {
  blur?: boolean;
}

const Image = forwardRef<HTMLImageElement, ImageProps>((props, ref) => {
  const { alt, className, blur = true, onLoad, ...rest } = props;
  const [isLoading, setLoading] = useState<boolean>(blur);
  return (
    <NextImage
      ref={ref}
      alt={alt}
      aria-label={alt}
      className={cn(
        className,
        "duration-700 ease-in-out",
        isLoading
          ? "scale-110 bg-slate-500 blur-2xl grayscale"
          : "scale-100 blur-0 grayscale-0"
      )}
      onLoad={(e) => {
        setLoading(false);
        onLoad && onLoad(e);
      }}
      {...rest}
    />
  );
});
Image.displayName = "Image";

export default Image;

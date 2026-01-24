"use client";

import type {
  ImageProps as NextImageProps,
  ImageLoaderProps,
} from "next/image";
import NextImage from "next/image";
import { useState, forwardRef } from "react";

import { cn } from "../utils/cn.util";

export interface ImageProps extends NextImageProps {
  blur?: boolean;
  enableCloudflareLoader?: boolean;
}

const cloudflareLoader = ({ src, width, quality }: ImageLoaderProps) => {
  const params = [`width=${width}`];
  if (quality) {
    params.push(`quality=${quality}`);
  }
  src = src.replace(/^\//, "");
  return `/cdn-cgi/image/${params.join(",")}/${src}`;
};

const Image = forwardRef<HTMLImageElement, ImageProps>((props, ref) => {
  const {
    alt,
    className,
    blur = true,
    onLoad,
    enableCloudflareLoader = false,
    loader,
    ...rest
  } = props;
  const [isLoading, setLoading] = useState<boolean>(blur);
  return (
    <NextImage
      ref={ref}
      alt={alt}
      aria-label={alt}
      className={cn(
        className,
        "duration-700 ease-in-out",
        !enableCloudflareLoader &&
          (isLoading
            ? "scale-110 bg-slate-500 blur-2xl grayscale"
            : "blur-0 scale-100 grayscale-0")
      )}
      onLoad={
        !enableCloudflareLoader
          ? (e) => {
              setLoading(false);
              if (onLoad) onLoad(e);
            }
          : onLoad
      }
      {...rest}
      loader={loader ?? (enableCloudflareLoader ? cloudflareLoader : undefined)}
    />
  );
});
Image.displayName = "Image";

export default Image;

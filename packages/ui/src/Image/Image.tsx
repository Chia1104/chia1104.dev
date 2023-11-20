import React, { type FC } from "react";
import NextImage, { type ImageProps as NextImageProps } from "next/image";
import { cn } from "../utils/cn.util";

export interface ImageProps extends NextImageProps {
  /**
   * @deprecated say goodbye to client component
   */
  blur?: boolean;
}

const keyStr =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

const triplet = (e1: number, e2: number, e3: number) =>
  keyStr.charAt(e1 >> 2) +
  keyStr.charAt(((e1 & 3) << 4) | (e2 >> 4)) +
  keyStr.charAt(((e2 & 15) << 2) | (e3 >> 6)) +
  keyStr.charAt(e3 & 63);

const rgbDataURL = (r: number, g: number, b: number) =>
  `data:image/gif;base64,R0lGODlhAQABAPAA${
    triplet(0, r, g) + triplet(b, 255, 255)
  }/yH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==`;

const Image: FC<ImageProps> = (props) => {
  const { alt, className, blur, ...rest } = props;
  return (
    <NextImage
      alt={alt}
      aria-label={alt}
      className={cn(className, "duration-700 ease-in-out")}
      placeholder="blur"
      blurDataURL={rgbDataURL(229, 231, 235)}
      {...rest}
    />
  );
};

export default Image;

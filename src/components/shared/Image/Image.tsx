import { type FC, memo } from "react";
import NextImage from "next/future/image";
import type { ImageProps as NextImageProps } from "next/future/image";
import { shimmer, toBase64 } from "@chia/utils/shimmer.util";

const Image: FC<NextImageProps> = (props) => {
  const { alt, ...rest } = props;
  return (
    <NextImage
      alt={alt}
      aria-label={alt}
      blurDataURL={`data:image/svg+xml;base64,${toBase64(shimmer(700, 700))}`}
      placeholder="blur"
      {...rest}
    />
  );
};

export default memo(Image);

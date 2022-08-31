import { type FC, memo } from "react";
import type { ImageProps as NextFutureImageProps } from "next/future/image";
import NextFutureImage from "next/future/image";
import { shimmer, toBase64 } from "@chia/utils/shimmer.util";

const FutureImage: FC<NextFutureImageProps> = (props) => {
  const { alt, ...rest } = props;
  return (
    <NextFutureImage
      alt={alt}
      aria-label={alt}
      blurDataURL={`data:image/svg+xml;base64,${toBase64(shimmer(700, 700))}`}
      placeholder="blur"
      {...rest}
    />
  );
};

export default memo(FutureImage);

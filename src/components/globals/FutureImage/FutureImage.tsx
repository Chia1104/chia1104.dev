import {FC, memo} from "react";
import type { ImageProps as NextFutureImageProps} from "next/future/image";
import NextFutureImage from "next/future/image";
import { shimmer, toBase64 } from '@chia/lib/loader/shimmer';

const FutureImage: FC<NextFutureImageProps> = (props) => {
    return (
        <NextFutureImage
            alt={props.alt}
            aria-label={props.alt}
            blurDataURL={`data:image/svg+xml;base64,${toBase64(shimmer(700, 700))}`}
            placeholder="blur"
            {...props}
            src={props.src}
        />
    )
}

export default memo(FutureImage);

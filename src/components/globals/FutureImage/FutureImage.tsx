import {FC, memo} from "react";
import type { ImageProps as NextFutureImageProps} from "next/future/image";
import NextFutureImage from "next/future/image";

const FutureImage: FC<NextFutureImageProps> = (props) => {
    return (
        <NextFutureImage
            alt={props.alt}
            aria-label={props.alt}
            {...props}
            src={props.src}
        />
    )
}

export default memo(FutureImage);

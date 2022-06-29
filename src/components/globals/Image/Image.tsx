import { FC, memo } from 'react';
import NextImage from 'next/image'
import type { ImageProps as NextImageProps} from "next/image";

const Image: FC<NextImageProps> = (props) => {
    return (
        <NextImage
            alt={props.alt}
            aria-label={props.alt}
            blurDataURL={'/loader/skeleton.gif'}
            placeholder="blur"
            {...props}
            src={props.src}
        />
    )
}

export default memo(Image);

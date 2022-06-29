import { FC } from 'react';
import NextImage from 'next/image'
import NextFutureImage from 'next/future/image'
import type { ImageProps as NextFutureImageProps} from "next/future/image";
import type { ImageProps as NextImageProps} from "next/image";

export const Image: FC<NextImageProps> = (props) => {
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

export const FutureImage: FC<NextFutureImageProps> = (props) => {
    return (
        <NextFutureImage
            alt={props.alt}
            aria-label={props.alt}
            {...props}
            src={props.src}
        />
    )
}

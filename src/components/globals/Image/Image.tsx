import { type FC, memo } from 'react';
import NextImage from 'next/image'
import type { ImageProps as NextImageProps} from "next/image";
import { shimmer, toBase64 } from '@chia/lib/loader/shimmer';

const Image: FC<NextImageProps> = (props) => {
    return (
        <NextImage
            alt={props.alt}
            aria-label={props.alt}
            blurDataURL={`data:image/svg+xml;base64,${toBase64(shimmer(700, 700))}`}
            placeholder="blur"
            {...props}
            src={props.src}
        />
    )
}

export default memo(Image);

import Image from 'next/image';
import { FC } from 'react';

interface Props {
    img_alt: string;
    img_src: string;
    aspect_width?: number;
    aspect_height?: number;
}

export const MDXImage: FC<Props> = (props) => {
    const w = props.aspect_width || 2;
    const h = props.aspect_height || 1;

    return (
        <div className="flex flex-col justify-center items-center my-5">
            <div className={`aspect-w-${w} aspect-h-${h} w-full overflow-hidden rounded-lg bg-gray-200 shadow-lg`}>
                <Image
                    src={props.img_src}
                    alt={props.img_alt}
                    aria-label={props.img_alt}
                    blurDataURL={'/loader/skeleton.gif'}
                    placeholder="blur"
                    className="rounded-lg hover:scale-[1.05] duration-300 transition ease-in-out"
                    loading="lazy"
                    objectFit="cover"
                    layout="fill"
                    quality={100}
                    {...props}
                />
            </div>
            <p className="self-center mt-2">{props.img_alt || ''}</p>
        </div>
    );
}


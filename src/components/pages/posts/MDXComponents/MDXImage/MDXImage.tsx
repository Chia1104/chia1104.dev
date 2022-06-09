import Image from 'next/image';
import { FC } from 'react';
import cx from 'classnames';

interface Props {
    img_alt: string;
    img_src: string;
    aspect_width?: number;
    aspect_height?: number;
    aspect?: string;
}

export const MDXImage: FC<Props> = (props) => {
    const w = props.aspect_width || 2;
    const h = props.aspect_height || 1;
    const aspect = props.aspect || '2:1';

    return (
        <div className="flex flex-col justify-center items-center my-5">
            <div className={cx('w-full overflow-hidden rounded-lg bg-gray-200 shadow-lg',
                // {[`aspect-w-${w}`]: w},
                // {[`aspect-h-${h}`]: h},
                aspect === '2:1' && 'aspect-w-2 aspect-h-1',
                aspect === '3:2' && 'aspect-w-3 aspect-h-2',
                aspect === '4:3' && 'aspect-w-4 aspect-h-3',
                aspect === '16:9' && 'aspect-w-16 aspect-h-9',
                aspect === '1:1' && 'aspect-w-1 aspect-h-1',
                aspect === '1:2' && 'aspect-w-1 aspect-h-2',
                aspect === '2:3' && 'aspect-w-2 aspect-h-3',
                aspect === '3:4' && 'aspect-w-3 aspect-h-4',
                aspect === '9:16' && 'aspect-w-9 aspect-h-16',
            )}>
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


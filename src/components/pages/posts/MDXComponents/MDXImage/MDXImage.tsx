import Image from 'next/image';
import { FC } from 'react';
import cx from 'classnames';

interface Props {
    alt: string;
    src: string;
    aspectwidth?: number;
    aspectheight?: number;
}

export const MDXImage: FC<Props> = (props) => {
    const w = props.aspectwidth || 2;
    const h = props.aspectheight || 1;

    return (
        <div className="flex flex-col justify-center items-center my-5">
            <div className={cx('w-full overflow-hidden rounded-lg bg-gray-200 shadow-lg',
                {[`aspect-w-${w}`]: w},
                {[`aspect-h-${h}`]: h},
            )}>
                <Image
                    aria-label={props.alt}
                    blurDataURL={'/loader/skeleton.gif'}
                    placeholder="blur"
                    className="rounded-lg hover:scale-[1.05] duration-300 transition ease-in-out"
                    loading="lazy"
                    objectFit="cover"
                    layout="fill"
                    quality={100}
                    {...props}
                    src={props.src}
                    alt={props.alt}
                />
            </div>
            <p className="self-center mt-2">{props.alt || ''}</p>
        </div>
    );
}


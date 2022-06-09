import Image from 'next/image';
import { FC } from 'react';
import cx from 'classnames';

interface Props {
    imgAlt: string;
    imgSrc: string;
    aspectWidth?: number;
    aspectHeight?: number;
}

export const MDXImage: FC<Props> = (props) => {
    const w = props.aspectWidth ? props.aspectWidth : 2;
    const h = props.aspectHeight ? props.aspectHeight : 1;

    return (
        <div className="flex flex-col justify-center items-center my-5">
            <div className={cx('w-full overflow-hidden rounded-lg bg-gray-200 shadow-lg',
                `aspect-w-${w} aspect-h-${h}`
            )}>
                <Image
                    src={props.imgSrc}
                    alt={props.imgAlt}
                    aria-label={props.imgAlt}
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
            <p className="self-center mt-2">{props.imgAlt || ''}</p>
        </div>
    );
}


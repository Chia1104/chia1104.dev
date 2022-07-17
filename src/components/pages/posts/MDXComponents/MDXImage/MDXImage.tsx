import Image from '@chia/components/globals/Image';
import { type FC } from 'react';
import cx from 'classnames';

interface Props {
    alt: string;
    src: string;
    aspectwidth?: number;
    aspectheight?: number;
    aspectratio?: string;
}

export const MDXImage: FC<Props> = (props) => {
    const w = props.aspectwidth || 2;
    const h = props.aspectheight || 1;
    const ratio = props.aspectratio?.trim() || '2:1';

    return (
        <div className="flex flex-col justify-center items-center my-5">
            <div className={cx('w-full overflow-hidden rounded-lg bg-gray-200 shadow-lg',
                // {[`aspect-w-${w}`]: w},
                // {[`aspect-h-${h}`]: h},
                ratio === '2:1' && 'aspect-w-2 aspect-h-1',
                ratio === '3:2' && 'aspect-w-3 aspect-h-2',
                ratio === '4:3' && 'aspect-w-4 aspect-h-3',
                ratio === '16:9' && 'aspect-w-16 aspect-h-9',
                ratio === '1:1' && 'aspect-w-1 aspect-h-1',
                ratio === '1:2' && 'aspect-w-1 aspect-h-2',
                ratio === '2:3' && 'aspect-w-2 aspect-h-3',
                ratio === '3:4' && 'aspect-w-3 aspect-h-4',
                ratio === '9:16' && 'aspect-w-9 aspect-h-16',
            )}>
                <Image
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


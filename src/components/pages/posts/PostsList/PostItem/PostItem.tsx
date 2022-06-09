import { FC } from 'react';
import type { PostFrontMatter } from '@chia/utils/types/post';
import dayjs from "dayjs";
import Image from 'next/image';
import cx from 'classnames';

interface Props {
    data: PostFrontMatter;
    i: number;
}

export const PostItem: FC<Props> = ({ data, i }) => {
    return (
        <div className="w-full p-3 rounded flex flex-col c-bg-secondary shadow-lg min-h-[530px] group hover:-translate-y-1.5 duration-300 transition ease-in-out">
            <div className={cx('aspect-w-4 aspect-h-3 w-full overflow-hidden rounded-lg bg-gray-200 mb-3', i === 0 && 'md:aspect-w-3 md:aspect-h-1')}>
                <Image
                    src={data.headImg || '/posts/example-posts/example.jpg'}
                    alt={data.title}
                    aria-label={data.title}
                    blurDataURL={'/loader/skeleton.gif'}
                    placeholder="blur"
                    className="rounded group-hover:scale-[1.1] duration-300 transition ease-in-out"
                    loading="lazy"
                    objectFit="cover"
                    layout="fill"
                    quality={100}
                />
            </div>
            <h2 className="text-3xl mb-3 group-hover:text-secondary duration-300 transition ease-in-out line-clamp-2">
                {data.title}
            </h2>
            <h3 className="line-clamp-3 text-xl mb-5">
                {data.excerpt}
            </h3>
            <p className="mt-auto text-lg c-description">
                {dayjs(data.createdAt).format('MMMM D, YYYY')} &mdash;{' '}
                {data.readingMins}
            </p>
        </div>
    )
}

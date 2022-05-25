import { FC } from 'react';
import { PostFrontMatter } from '@/utils/types/post';
import dayjs from "dayjs";
import Image from 'next/image';

interface Props {
    data: PostFrontMatter;
    i: number;
}

export const PostItem: FC<Props> = ({ data, i }) => {
    return (
        <div className="w-full p-3 c-border-primary border-2 rounded-xl flex flex-col c-bg-secondary shadow-lg min-h-[530px]">
            <div className={i === 0 ? 'aspect-w-4 aspect-h-3 md:aspect-w-3 md:aspect-h-1 w-full overflow-hidden rounded-lg bg-gray-200 mb-3' : 'aspect-w-4 aspect-h-3 w-full overflow-hidden rounded-lg bg-gray-200 mb-3'}>
                <Image
                    src={data.headImg || '/posts/example-posts/example.jpg'}
                    alt={data.title}
                    aria-label={data.title}
                    blurDataURL={'/loader/skeleton.gif'}
                    placeholder="blur"
                    className="rounded-lg"
                    loading="lazy"
                    objectFit="cover"
                    layout="fill"
                    quality={100}
                />
            </div>
            <h2 className="text-4xl mb-3">
                {data.title}
            </h2>
            <h3 className="line-clamp-2 text-2xl mb-5">
                {data.excerpt}
            </h3>
            <p className="mt-auto text-2xl">
                {dayjs(data.createdAt).format('MMMM D, YYYY')} &mdash;{' '}
                {data.readingMins}
            </p>
        </div>
    )
}

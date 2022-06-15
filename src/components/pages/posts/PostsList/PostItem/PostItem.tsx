import { FC } from 'react';
import type { PostFrontMatter } from '@chia/utils/types/post';
import dayjs from "dayjs";
import Image from 'next/image';
import cx from 'classnames';
import Link from "next/link";

interface Props {
    data: PostFrontMatter;
    i: number;
}

export const PostItem: FC<Props> = ({ data, i }) => {
    return (
        <div className="w-full p-3 rounded flex flex-col c-bg-secondary shadow-lg min-h-[550px] group hover:-translate-y-1.5 duration-300 transition ease-in-out relative">
            <div className={cx('aspect-w-16 aspect-h-9 w-full overflow-hidden rounded-lg bg-gray-200 mb-3', i === 0 && 'lg:aspect-w-3 lg:aspect-h-1')}>
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
            <header className="text-3xl mb-3 group-hover:text-secondary duration-300 transition ease-in-out line-clamp-2 leading-normal mx-2">
                {data.title}
            </header>
            <p className="line-clamp-3 text-xl leading-normal mb-3 mx-2">
                {data.excerpt}
            </p>
            <footer className="mt-auto text-xl c-description mx-2">
                {dayjs(data.createdAt).format('MMMM D, YYYY')} &mdash;{' '}
                {data.readingMins}
            </footer>
            <Link
                href={{
                    pathname: "/posts/[slug]/",
                    query: { slug: data.slug },
                }}
                passHref
            >
                <a className="absolute top-0 bottom-0 right-0 left-0" />
            </Link>
        </div>
    )
}

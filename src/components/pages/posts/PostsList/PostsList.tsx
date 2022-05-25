import { FC } from 'react';
import { PostFrontMatter } from '@/utils/types/post';
import { PostItem } from "./PostItem";
import Link from "next/link";
import cx from 'classnames';

interface Props {
    post: PostFrontMatter;
}

export const PostsList: FC<Props> = ({ post }) => {
    return (
        <div className="w-full grid grid-cols-1 md:grid-cols-2
          xl:grid-cols-3 gap-10">
            {
                // @ts-ignore
                post.map((post: PostFrontMatter, index) => (
                    <Link
                        href={`/posts/${post.slug}`}
                        passHref
                        key={post.id}
                    >
                        <a
                           className={cx(index === 0 ? 'md:col-span-2 w-full hover:scale-[1.03] transition ease-in-out' : 'w-full hover:scale-[1.03] transition ease-in-out')}>
                            <PostItem data={post} i={index}/>
                        </a>
                    </Link>
                ))
            }
        </div>
    )
}

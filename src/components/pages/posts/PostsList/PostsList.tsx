import { type FC } from 'react';
import type { PostFrontMatter } from '@chia/utils/types/post';
import { PostItem } from "./PostItem";
import { motion } from "framer-motion";
import cx from 'classnames';

interface Props {
    post: PostFrontMatter[];
}

const postAnimation = {
    show: { transition: { staggerChildren: 0.1 } },
};

const postCardAnimation = {
    show: {
        y: [75, 0],
        opacity: [0, 1],
    },
}

export const PostsList: FC<Props> = ({ post }) => {
    return (
        <motion.div
            className="w-full grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-10"
            variants={postAnimation}
            animate={'show'}
        >
            {
                post.map((post: PostFrontMatter, index) => (
                    <motion.article
                        key={post.id}
                        variants={postCardAnimation}
                        className={cx('w-full h-auto',
                            index === 0 && 'lg:col-span-2')}>
                        <PostItem data={post} i={index}/>
                    </motion.article>
                ))
            }
        </motion.div>
    )
}

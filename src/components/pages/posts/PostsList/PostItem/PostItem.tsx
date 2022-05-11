import { FC } from 'react';
import { Post } from '../../../../../../utils/types/interfaces/post';
import dayjs from "dayjs";

interface Props {
    data: Post;
}

export const PostItem: FC<Props> = ({ data }) => {
    return (
        <div className="w-full p-3 c-border-primary border-2 rounded-xl flex flex-col c-bg-secondary shadow-lg">
            <h2 className="text-2xl mb-3">
                {data.title}
            </h2>
            <h3 className="truncate text-xl mb-5">
                {data.excerpt}
            </h3>
            <p>
                {dayjs(data.createdAt).format('MMMM D, YYYY')} &mdash;{' '}
                {data.readingTime}
            </p>
        </div>
    )
}

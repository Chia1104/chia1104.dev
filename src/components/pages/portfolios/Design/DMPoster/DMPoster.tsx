import { FC } from "react";
import Image from "next/image";

interface Props {
    url: string;
}

export const DMPoster: FC<Props> = ({ url }) => {
    return (
        <div className="aspect-w-1 aspect-h-2 w-full overflow-hidden rounded-lg bg-gray-200">
            <Image
                src={url || '/posts/example-posts/example.jpg'}
                alt={'DMPoster'}
                aria-label={'DMPoster'}
                blurDataURL={'/loader/skeleton.gif'}
                placeholder="blur"
                className="rounded group-hover:scale-[1.1] duration-300 transition ease-in-out"
                loading="lazy"
                objectFit="cover"
                layout="fill"
            />
        </div>
    )
}

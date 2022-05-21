import Image from 'next/image';

export const MDXImage = (props: any) => {
    return (
        <div className="w-full flex flex-col justify-center items-centerr overflow-hidden my-5">
            <Image
                alt={props.alt || 'image'}
                aria-label={props.alt}
                blurDataURL={'/loader/skeleton.gif'}
                placeholder="blur"
                className="rounded-lg"
                loading="lazy"
                objectFit="cover"
                {...props}
            />
            <p className="mt-1 self-center">{props.alt || ''}</p>
        </div>
    );
}


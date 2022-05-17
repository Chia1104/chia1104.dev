import Image from 'next/image';

export const MDXImage = (props: any) => {
    return (
        <div className="w-full flex justify-center items-centerr overflow-hidden my-5">
            <Image
                aria-label={props.alt}
                blurDataURL={'/loader/skeleton.gif'}
                placeholder="blur"
                className="rounded-lg"
                loading="lazy"
                objectFit="cover"
                {...props}
            />
        </div>
    );
}


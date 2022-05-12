import Image from 'next/image';

export const MDXImage = (props: any) => {
    return (
        <div className="w-full flex justify-center items-centerr overflow-hidden my-5">
            <Image alt={props.alt} className="rounded-lg" {...props} />
        </div>
    );
}

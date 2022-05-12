

export const MDXTitle = (props: any) => {
    return (
        <h1 {...props} className="text-left text-2xl w-full border-b-2 c-border-primary pb-3 my-5">
            {props.children}
        </h1>
    );
}

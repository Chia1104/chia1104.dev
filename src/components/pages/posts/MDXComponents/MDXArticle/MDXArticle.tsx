

export const MDXArticle = (props: any) => {
    return (
        <h3 className="w-full mb-2" {...props}>
            {props.children}
        </h3>
    );
}

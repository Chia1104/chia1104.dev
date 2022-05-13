

const MDXArticle = (props: any) => {
    return (
        <h3 className="w-full mb-2 text-lg" {...props}>
            {props.children}
        </h3>
    );
}

export default MDXArticle;



const MDXTitle2 = (props: any) => {
    return (
        <h2 {...props} className="text-left text-2xl w-full pb-3 my-5 ml-3">
            {props.children}
        </h2>
    );
}

export default MDXTitle2;

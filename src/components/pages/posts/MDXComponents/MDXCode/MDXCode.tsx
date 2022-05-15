
export const MDXCode = (props: any) => {

    return (
        <div className="relative">
            <div className="bg-info/70 -top-4 absolute border-2 border-info rounded-full px-3 py-1 text-white">
                info
            </div>
            <div className="bg-code w-full my-7 p-2 pt-7 rounded-xl text-white overflow-x-auto">
                {props.children}
            </div>
        </div>
    );
}


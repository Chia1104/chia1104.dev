
export const MDXCode = (props: any, type: string, msg: string) => {
    type = 'info'

    return (
        <div className="relative">
            {
                type === 'info' &&
                <div className="bg-info/70 -top-4 absolute border-2 border-info rounded-full px-3 py-1 text-white">
                    {msg || 'info'}
                </div>
            }
            {
                type === 'warning' &&
                <div className="bg-warning/70 -top-4 absolute border-2 border-warning rounded-full px-3 py-1 text-white">
                    {msg|| 'warning'}
                </div>
            }
            {
                type === 'error' &&
                <div className="bg-danger/70 -top-4 absolute border-2 border-danger rounded-full px-3 py-1 text-white">
                    {msg || 'error'}
                </div>
            }
            <div className="bg-code w-full my-7 p-2 pt-7 rounded-xl text-white overflow-x-auto">
                {props.children}
            </div>
        </div>
    );
}


import {FC, ReactNode} from 'react';

interface Props {
    children: ReactNode
}

export const MDXTable: FC<Props> = (props) => {
    return (
        <>
            <table {...props} className="table-fixed w-full lg:w-[50%] border-collapse border border-slate-500">
                {props.children}
            </table>
        </>
    )
}

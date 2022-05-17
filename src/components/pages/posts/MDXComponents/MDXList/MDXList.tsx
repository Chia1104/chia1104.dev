import {FC, ReactNode} from 'react';

interface Props {
    children: ReactNode
    listType?: string
}

export const MDXList: FC<Props> = (props) => {
    return (
        <>
            <ul {...props} className="p-3 border-info border-l-4 bg-gradient-to-r from-info/70 to-info/40 list-disc pl-10 my-10">
                {props.children}
            </ul>
        </>
    )
}

export const MDXListItem: FC<Props> = (props) => {
    return (
        <>
            <li {...props} className="">
                {props.children}
            </li>
        </>
    )
}

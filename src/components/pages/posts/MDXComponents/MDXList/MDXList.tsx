import {FC, ReactNode} from 'react';

interface Props {
    children: ReactNode
    type?: string
}

export const MDXUl: FC<Props> = (props) => {
    return (
        <>
            <ul {...props} className="p-3 list-disc pl-5">
                {props.children}
            </ul>
        </>
    )
}

export const MDXList: FC<Props> = (props) => {
    return (
        <>
            {
                props.type === 'tips' && (
                    <div {...props} className="p-3 py-1 border-gray-400 border-l-4 bg-gradient-to-r from-gray-400/70 to-gray-400/40 my-10">
                        {props.children}
                    </div>
                )
            }
            {
                props.type === 'info' && (
                    <div {...props} className="p-3 py-1 border-info border-l-4 bg-gradient-to-r from-info/70 to-info/40 my-10">
                        {props.children}
                    </div>
                )
            }
            {
                props.type === 'success' && (
                    <div {...props} className="p-3 py-1 border-success border-l-4 bg-gradient-to-r from-success/70 to-success/40 my-10">
                        {props.children}
                    </div>
                )
            }
            {
                props.type === 'warning' && (
                    <div {...props} className="p-3 py-1 border-warning border-l-4 bg-gradient-to-r from-warning/70 to-warning/40 my-10">
                        {props.children}
                    </div>
                )
            }
            {
                props.type === 'error' && (
                    <div {...props} className="p-3 py-1 border-danger border-l-4 bg-gradient-to-r from-danger/70 to-danger/40 my-10">
                        {props.children}
                    </div>
                )
            }
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

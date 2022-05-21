import {FC, ReactNode} from 'react';

interface Props {
    children: ReactNode
    type?: string
}

export const MDXQuote: FC<Props> = (props) => {
    return (
        <>
            {
                props.type === 'tips' && (
                    <blockquote {...props} className="p-3 py-1 border-gray-400 border-l-4 bg-gradient-to-r from-gray-400/70 to-gray-400/40 my-10">
                        {props.children}
                    </blockquote>
                )
            }
            {
                props.type === 'info' && (
                    <blockquote {...props} className="p-3 py-1 border-info border-l-4 bg-gradient-to-r from-info/70 to-info/40 my-10">
                        {props.children}
                    </blockquote>
                )
            }
            {
                props.type === 'success' && (
                    <blockquote {...props} className="p-3 py-1 border-success border-l-4 bg-gradient-to-r from-success/70 to-success/40 my-10">
                        {props.children}
                    </blockquote>
                )
            }
            {
                props.type === 'warning' && (
                    <blockquote {...props} className="p-3 py-1 border-warning border-l-4 bg-gradient-to-r from-warning/70 to-warning/40 my-10">
                        {props.children}
                    </blockquote>
                )
            }
            {
                props.type === 'error' && (
                    <blockquote {...props} className="p-3 py-1 border-danger border-l-4 bg-gradient-to-r from-danger/70 to-danger/40 my-10">
                        {props.children}
                    </blockquote>
                )
            }
        </>
    )
}

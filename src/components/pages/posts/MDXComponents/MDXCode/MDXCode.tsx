import { ReactNode, FC } from "react";

interface Props {
    children: ReactNode;
    text?: string;
    type?: string;
}

export const MDXCode: FC<Props> = ({children, text, type}) => {
    return (
        <div className="relative mt-10">
            {
                type === 'info' && (
                    <div className="bg-info/70 -top-4 absolute border-2 border-info rounded-full px-3 py-1 c-text-secondary">
                        {text}
                    </div>
                )
            }
            {
                type === 'success' && (
                    <div className="bg-success/70 -top-4 absolute border-2 border-success rounded-full px-3 py-1 c-text-secondary">
                        {text}
                    </div>
                )
            }
            {
                type === 'warning' && (
                    <div className="bg-warning/70 -top-4 absolute border-2 border-warning rounded-full px-3 py-1 c-text-secondary">
                        {text}
                    </div>
                )
            }
            {
                type === 'error' && (
                    <div className="bg-danger/70 -top-4 absolute border-2 border-danger rounded-full px-3 py-1 c-text-secondary">
                        {text}
                    </div>
                )
            }
            {children}
        </div>
    );
}

export const MDXPre: FC<Props> = (props) => {
    return (
        <pre {...props} className="dark:bg-code bg-[#dddddd] w-full my-7 p-7 pb-4 rounded-xl dark:text-white text:black overflow-x-auto transition ease-in-out">
            {props.children}
        </pre>
    )
}

export const MDXCodeOrigin: FC<Props> = (props) => {
    return (
        <code {...props} className="dark:bg-code bg-[#dddddd] rounded dark:text-white text:black overflow-x-auto transition ease-in-out p-0.5">
            {props.children}
        </code>
    )
}


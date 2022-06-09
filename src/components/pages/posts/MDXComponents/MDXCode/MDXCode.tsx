import { ReactNode, FC } from "react";
import cx from "classnames";

interface Props {
    children: ReactNode;
    text?: string;
    type?: string;
}

export const MDXCode: FC<Props> = ({children, text, type}) => {
    if (!type) type = "info";

    return (
        <div className="relative mt-10">
            <div className={cx('-top-4 absolute border-2 rounded-full px-3 py-1 c-text-secondary',
                type === 'info' && 'bg-info/70 border-info',
                type === 'warning' && 'bg-warning/70 border-warning',
                type === 'success' && 'bg-success/70 border-success',
                type === 'error' && 'bg-danger/70 border-danger'
            )}>
                {text || 'Code info'}
            </div>
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


import { ReactNode, FC } from "react";

interface Props {
    children: ReactNode;
    infoText?: string;
    infoType?: string;
}

export const MDXCode: FC<Props> = ({children, infoText, infoType}) => {
    return (
        <div className="relative mt-10">
            {
                infoType === 'info' && (
                    <div className="bg-info/70 -top-4 absolute border-2 border-info rounded-full px-3 py-1 text-white">
                        {infoText}
                    </div>
                )
            }
            {
                infoType === 'warning' && (
                    <div className="bg-warning/70 -top-4 absolute border-2 border-warning rounded-full px-3 py-1 text-white">
                        {infoText}
                    </div>
                )
            }
            {
                infoType === 'error' && (
                    <div className="bg-danger/70 -top-4 absolute border-2 border-danger rounded-full px-3 py-1 text-white">
                        {infoText}
                    </div>
                )
            }
            {children}
        </div>
    );
}

export const MDXPre: FC<Props> = (props) => {
    return (
        <pre {...props} className="bg-code w-full my-7 p-2 rounded-xl text-white overflow-x-auto">
            {props.children}
        </pre>
    )
}


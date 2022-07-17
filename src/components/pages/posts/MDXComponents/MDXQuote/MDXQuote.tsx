import {type FC, type ReactNode} from 'react';
import cx from 'classnames';

interface Props {
    children: ReactNode
    type?: string
}

export const MDXQuote: FC<Props> = (props) => {
    if (!props.type) props.type = 'tips';

    return (
        <>
            <blockquote {...props} className={cx('p-3 border-l-4 bg-gradient-to-r my-10',
                props.type === 'tips' && 'border-gray-400 from-gray-400/70 to-gray-400/40',
                props.type === 'info' && 'border-info from-info/70 to-info/40',
                props.type === 'success' && 'border-success from-success/70 to-success/40',
                props.type === 'warning' && 'border-warning from-warning/70 to-warning/40',
                props.type === 'error' && 'border-danger from-danger/70 to-danger/40'
            )}>
                {props.children}
            </blockquote>
        </>
    )
}

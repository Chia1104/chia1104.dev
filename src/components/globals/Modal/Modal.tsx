import { FC, ReactNode } from "react";
import {AnimatePresence, motion} from "framer-motion";
import useLockedBody from "@chia/src/hooks/useLockedBody";

interface Props {
    isShow: boolean;
    children: ReactNode;
    onClick: () => void;
    className?: string;
}

export const Modal: FC<Props> = (props) => {
    const ov = {
        open: { opacity: 1 },
        closed: { opacity: 0, delay: 300 },
    }
    const iv = {
        open: { opacity: 1, y: 0, delay: 3000 },
        closed: { opacity: 0, y: -100 },
    }
    useLockedBody(props.isShow)

    return (
        <AnimatePresence>
            {
                props.isShow && (
                    <motion.div
                        onClick={props.onClick}
                        initial={'closed'}
                        animate={ props.isShow ? 'open' : 'closed' }
                        exit={'closed'}
                        variants={ov}
                        className="modal">
                        <motion.div
                            initial={'closed'}
                            animate={ props.isShow ? 'open' : 'closed' }
                            exit={'closed'}
                            variants={iv}
                            {...props}
                        >
                            {props.children}
                        </motion.div>
                    </motion.div>
                )
            }
        </AnimatePresence>
    )
}

import { FC, ReactNode } from "react";
import {AnimatePresence, motion} from "framer-motion";

interface Props {
    isShow: boolean;
    children: ReactNode;
    handleClose: () => void;
    className?: string;
}

export const Modal: FC<Props> = (props) => {
    const ov = {
        open: { opacity: 1 },
        closed: { opacity: 0, delay: 300 },
    }
    const iv = {
        open: { opacity: 1, y: 0 },
        closed: { opacity: 0, y: -100 },
    }

    return (
        <AnimatePresence>
            {
                props.isShow && (
                    <motion.div
                        onClick={props.handleClose}
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
                            // className="w-[300px]"
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

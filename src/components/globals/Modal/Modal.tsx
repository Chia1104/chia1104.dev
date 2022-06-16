import { FC } from "react";
import { motion } from "framer-motion";

interface Props {
    isShow: boolean;
    children: React.ReactNode;
    handleClose: () => void;
}

export const Modal: FC<Props> = ({ children, isShow, handleClose }) => {
    const v = {
        open: { opacity: 1, delay: 0.01, duration: 300 },
        closed: { opacity: 0 },
    }

    return (
        <motion.div
            onClick={handleClose}
            initial={'closed'}
            animate={ isShow ? 'open' : 'closed' }
            variants={v}
            className="modal">
            {children}
        </motion.div>
    )
}

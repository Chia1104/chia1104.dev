import { type FC, type ReactNode, memo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import useLockedBody from "@chia/hooks/useLockedBody";

interface Props {
  showed: boolean;
  children: ReactNode;
  onClick: () => void;
  className?: string;
}

const Modal: FC<Props> = (props) => {
  const ov = {
    open: { opacity: 1 },
    closed: { opacity: 0, delay: 300 },
  };
  const iv = {
    open: { opacity: 1, y: 0, delay: 3000 },
    closed: { opacity: 0, y: -100 },
  };
  useLockedBody(props.showed);

  return (
    <AnimatePresence>
      {props.showed && (
        <motion.div
          onClick={props.onClick}
          initial={"closed"}
          animate={props.showed ? "open" : "closed"}
          exit={"closed"}
          variants={ov}
          className="modal"
        >
          <motion.div
            initial={"closed"}
            animate={props.showed ? "open" : "closed"}
            exit={"closed"}
            variants={iv}
            {...props}
          >
            {props.children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default memo(Modal, (prev, next) => prev.showed === next.showed);

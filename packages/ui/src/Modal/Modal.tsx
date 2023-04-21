"use client";

import React, { type FC } from "react";
import { AnimatePresence, motion, type MotionProps } from "framer-motion";
import useLockedBody from "../utils/use-locked-body.ts";
import { createPortal } from "react-dom";
import usePortal from "../utils/use-portal.ts";
import { cn } from "../utils/cn.util.ts";

interface ModalProps extends MotionProps {
  isShowed: boolean;
  activeModal: () => void;
  className?: string;
}

const Modal: FC<ModalProps> = (props) => {
  const { isShowed, children, activeModal, className, ...rest } = props;
  const ov = {
    open: { opacity: 1 },
    closed: { opacity: 0, delay: 300 },
  };
  const iv = {
    open: { opacity: 1, y: 0, delay: 3000 },
    closed: { opacity: 0, y: -100 },
  };
  useLockedBody(isShowed);
  const portal = usePortal("__modal_root");
  if (!portal) return null;

  return createPortal(
    <AnimatePresence>
      {isShowed && (
        <motion.div
          transition={{ duration: 0.5, type: "spring" }}
          onClick={activeModal}
          initial="closed"
          animate={isShowed ? "open" : "closed"}
          exit="closed"
          variants={ov}
          className="modal">
          <motion.div
            transition={{ duration: 0.5, type: "spring" }}
            initial="closed"
            onClick={(e) => e.stopPropagation()}
            animate={isShowed ? "open" : "closed"}
            exit="closed"
            variants={iv}
            className={cn(className, "p-5")}
            {...rest}>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    portal
  );
};

export default Modal;

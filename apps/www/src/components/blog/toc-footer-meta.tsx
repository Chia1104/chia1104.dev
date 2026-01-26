"use client";

import { useEffect, useState, useCallback, useMemo } from "react";

import { motion, AnimatePresence } from "motion/react";

interface Props {
  readTimeText?: string;
  targetId?: string;
}

const TocFooterMeta = ({ readTimeText, targetId = "feed-meta" }: Props) => {
  const [isVisible, setIsVisible] = useState(false);

  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (!entry) return;
      setIsVisible(!entry.isIntersecting);
    },
    []
  );

  useEffect(() => {
    const target = document.getElementById(targetId);

    if (!target) {
      return;
    }

    const observer = new IntersectionObserver(handleIntersection, {
      threshold: 0,
      rootMargin: "0px",
    });

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [targetId, handleIntersection]);

  const animationVariants = useMemo(
    () => ({
      hidden: {
        opacity: 0,
        height: 0,
      },
      visible: {
        opacity: 1,
        height: "auto",
      },
    }),
    []
  );

  if (!readTimeText) {
    return null;
  }

  return (
    <AnimatePresence mode="wait">
      {isVisible && (
        <motion.div
          key="toc-footer-meta"
          className="text-foreground-700 flex items-center self-end overflow-hidden text-sm"
          initial="hidden"
          animate="visible"
          exit="hidden"
          variants={animationVariants}
          transition={{ duration: 0.2, ease: "easeOut" }}>
          <span>{readTimeText}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TocFooterMeta;

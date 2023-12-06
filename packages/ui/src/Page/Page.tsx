"use client";

import { type FC, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";

interface Props {
  children: ReactNode;
}

const Page: FC<Props> = (props) => {
  const { children } = props;
  const pathname = usePathname();
  return (
    <AnimatePresence key={pathname} mode="wait">
      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, type: "spring" }}>
        {children}
      </motion.main>
    </AnimatePresence>
  );
};

export default Page;

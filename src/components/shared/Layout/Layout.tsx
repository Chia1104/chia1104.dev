import { type FC, type ReactNode } from "react";
import { Head } from "./Head";
import { motion } from "framer-motion";

interface Props {
  children: ReactNode;
  title: string;
  description: string;
  canonicalUrl?: string;
  keywords?: string[];
  type?: "website" | "article" | "book" | "profile";
}

const Layout: FC<Props> = (props) => {
  const { children, title, description, canonicalUrl, keywords, type } = props;
  return (
    <>
      <Head
        title={title}
        description={description}
        canonicalUrl={canonicalUrl}
        keywords={keywords}
        type={type}
      />
      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}>
        {children}
      </motion.main>
    </>
  );
};

export default Layout;

import React, { FC } from 'react';
import { Head } from "./Head";
import { motion } from 'framer-motion'

interface Props {
    children: React.ReactNode,
    title: string,
    description: string,
}

export const Layout: FC<Props> = ({children, title,description,}) => {
    return (
        <>
            <Head
                title={title}
                description={description}
            />
            <motion.main
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
            >
                <main>
                    {children}
                </main>
            </motion.main>
        </>
    )
}

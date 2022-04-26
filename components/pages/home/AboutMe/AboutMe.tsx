import { motion } from "framer-motion";
import { FC } from "react";
import { useRouter } from "next/router";

export const AboutMe: FC = () => {
    const router = useRouter()

    return (
        <>
            <motion.div
                initial="hidden"
                animate="visible"
                variants={{
                    hidden: {
                        opacity: 0,
                        y: -100
                    },
                    visible: {
                        opacity: 1,
                        y: 0,
                        transition: {
                            delay: 0.5,
                            duration: 0.3,
                            ease: [0.48, 0.15, 0.25, 0.96]
                        }
                    }
                }}
            >
                <h1 className="title text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
                    HOME Page
                </h1>
            </motion.div>
            <button type="button" onClick={() => router.push('/post')}>
                Post
            </button>
            <button type="button" onClick={() => router.push('/result')}>
                Result
            </button>
            <article>
                <h1>Hello Next.js</h1>
                <p>
                    This is the content of the page.
                </p>
            </article>
        </>
    )
}

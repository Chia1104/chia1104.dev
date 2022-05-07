import { motion } from "framer-motion";
import Image from 'next/image'
import { FC } from "react";

export const AboutMe: FC = () => {

    return (
        <div className="w-full h-full flex flex-col xl:flex-row px-3 justify-center z-20">
            <motion.div
                className="flex flex-col justify-end items-center xl:items-end mb-5 xl:pr-5"
                initial="hidden"
                animate="visible"
                variants={{
                    hidden: {
                        opacity: 0,
                        y: -50
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
                <h1
                    className="title text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
                    Yu Chia, Yu
                </h1>
                <h2 className="description text-white">
                    WEB DEVELOPER
                </h2>
            </motion.div>
            <div className="flex justify-center items-center">
                <Image
                    src="https://firebasestorage.googleapis.com/v0/b/chia1104.appspot.com/o/me-images%2Fme.JPG?alt=media&token=dee7b2ae-6625-4d4f-85c9-75d54a2da811"
                    alt="Chia1104"
                    width={400}
                    height={300}
                    className="rounded-xl"
                    priority
                />
            </div>
        </div>
    )
}

import { FC, useRef, useState } from "react";
import useHover from "@chia/src/hooks/useHover";
import Image from "next/image";
import cx from "classnames";
import { motion } from "framer-motion";
// import {Modal} from "@chia/components/globals/Modal";

interface Props {
    url: string;
}

export const DMPoster: FC<Props> = ({ url }) => {
    const r = useRef(null);
    const isHover = useHover(r)
    const [isShow, setIsShow] = useState(false)

    const handleClose = () => setIsShow(false)

    const v = {
        open: { opacity: 1, y: 0 },
        closed: { opacity: 0, y: -20 },
    }

    return (
        <div className="aspect-w-3 aspect-h-5 w-full overflow-hidden rounded-lg bg-gray-200 shadow-lg relative" ref={r}>
            <Image
                src={url || '/posts/example-posts/example.jpg'}
                alt={'DMPoster'}
                aria-label={'DMPoster'}
                blurDataURL={'/loader/skeleton.gif'}
                placeholder="blur"
                className={cx('rounded duration-300 transition ease-in-out', isHover && 'scale-[1.1]')}
                loading="lazy"
                objectFit="cover"
                layout="fill"
                quality={100}
            />
            <motion.div
                initial={'closed'}
                animate={isHover ? 'open' : 'closed'}
                variants={v}
                className="w-full h-full bg-gradient-to-b from-gray-600/70 to-gray-600/0 absolute bottom-0 left-0 flex justify-center items-center">
                <button
                    onClick={() => setIsShow(!isShow)}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                    </svg>
                </button>
            </motion.div>
            {/*{*/}
            {/*    isShow && (*/}
            {/*        <Modal*/}
            {/*            isShow={isShow}*/}
            {/*            handleClose={handleClose}*/}
            {/*        >*/}
            {/*            <img*/}
            {/*                src={url}*/}
            {/*                alt={'DMPoster'}*/}
            {/*                aria-label={'DMPoster'}*/}
            {/*                width={'100%'}*/}
            {/*                height={'auto'}*/}
            {/*                className="w-[75%] max-w-[750px]"*/}
            {/*            />*/}
            {/*        </Modal>*/}
            {/*    )*/}
            {/*}*/}
        </div>
    )
}

import { FC, useRef, useState } from "react";
import useHover from "@chia/src/hooks/useHover";
import Image from "next/image";
import cx from "classnames";
import {Modal} from "@chia/components/globals/Modal";
import {HoverButton} from "@chia/components/globals/HoverButton";

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
            <HoverButton
                handleClick={() => setIsShow(!isShow)}
                refTarget={r}
            />
            <Modal
                isShow={isShow}
                handleClose={handleClose}
                className="w-[85%] max-w-[550px]"
            >
                <div className="w-full aspect-w-1 aspect-h-1">
                    <Image
                        src={url || '/posts/example-posts/example.jpg'}
                        alt={'DMPoster'}
                        aria-label={'DMPoster'}
                        blurDataURL={'/loader/skeleton.gif'}
                        placeholder="blur"
                        loading="lazy"
                        layout="fill"
                        objectFit="contain"
                        quality={100}
                    />
                </div>
            </Modal>
        </div>
    )
}

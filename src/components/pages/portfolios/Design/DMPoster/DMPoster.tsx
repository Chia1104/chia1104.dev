import { FC, useRef, useState } from "react";
import useHover from "@chia/src/hooks/useHover";
import { Image } from '@chia/components/globals/Image';
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

    return (
        <div className="aspect-w-3 aspect-h-5 w-full overflow-hidden rounded-lg bg-gray-200 shadow-lg relative" ref={r}>
            <Image
                src={url || '/posts/example-posts/example.jpg'}
                alt={'DMPoster'}
                className={cx('rounded duration-300 transition ease-in-out', isHover && 'scale-[1.1]')}
                loading="lazy"
                objectFit="cover"
                layout="fill"
                quality={100}
            />
            <HoverButton
                onClick={() => setIsShow(!isShow)}
                reftarget={r}
            />
            <Modal
                isShow={isShow}
                onClick={handleClose}
                className="w-full max-w-lg md:max-w-xl lg:max-w-2xl xl:max-w-3xl"
            >
                <div className="w-full aspect-w-1 aspect-h-1">
                    <Image
                        src={url || '/posts/example-posts/example.jpg'}
                        alt={'DMPoster'}
                        loading="lazy"
                        objectFit="contain"
                        layout="fill"
                        quality={100}
                    />
                </div>
            </Modal>
        </div>
    )
}

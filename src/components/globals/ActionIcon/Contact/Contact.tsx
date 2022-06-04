import { FC } from "react";
import { useForm, ValidationError } from '@formspree/react';
import Image from "next/image";
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import {useAppDispatch} from "@chia/src/hooks/useAppDispatch";
import {activeActionIconSheet, selectActionIconSheet} from "@chia/store/modules/ActionSheet/actionSheet.slice";
import { motion } from "framer-motion"
import {useAppSelector} from "@chia/src/hooks/useAppSelector";
import Script from "next/script";

const outside = {
    open: { opacity: 1, height: '550px', width: '330px' },
    closed: { opacity: 0, height: 0, width: 0, transition: { delay: 0.2 } },
}
const inside = {
    open: { opacity: 1, y: 0 },
    closed: { opacity: 0, y: 100 },
}

const FORMSPREE_KEY = process.env.NEXT_PUBLIC_FORMSPREE_KEY as string;

export const Contact: FC = () => {
    const dispatch = useAppDispatch()
    const actionIconSheet = useAppSelector(selectActionIconSheet)
    const [state, handleSubmit] = useForm(FORMSPREE_KEY);
    return (
        <motion.div
            initial={'closed'}
            animate={actionIconSheet ? "open" : "closed"}
            variants={outside}
        >
            <motion.div
                animate={actionIconSheet ? "open" : "closed"}
                variants={inside}
                className="flex flex-col justify-start items-center w-full h-full"
            >
                <button
                    aria-label={"Close contact"}
                    onClick={() => dispatch(activeActionIconSheet())}
                    className="hover:text-secondary  transition ease-in-out"
                >
                    <KeyboardArrowDownIcon
                        fontSize="large"
                    />
                </button>
                <form
                    className="w-full flex flex-col mx-auto"
                    onSubmit={handleSubmit}>
                    <h1 className="text-3xl mb-5">Contact Me</h1>
                    <h2 className="text-xl pb-2">Email</h2>
                    <input
                        type="email"
                        name="email"
                        className="w-full h-10 p-2 border-2 border-primary rounded-lg mb-4"
                        placeholder={'Your email'}
                        required
                    />
                    <ValidationError
                        prefix="Email"
                        field="email"
                        errors={state.errors}
                        className="text-warning mt-2"
                    />
                    <h2 className="text-xl pb-2">Message</h2>
                    <textarea
                        name="message"
                        className="w-full max-h-36 p-2 border-2 border-primary rounded-lg mb-4 overflow-y-auto"
                        placeholder={'Your message'}
                        required
                    />
                    <ValidationError
                        prefix="Message"
                        field="message"
                        errors={state.errors}
                        className="text-warning mt-2"
                    />
                    <button
                        type="submit"
                        disabled={state.submitting}
                        className="self-center c-bg-gradient-green-to-purple w-[85px] h-10 rounded-full flex justify-center items-center text-white hover:scale-[1.05] transition ease-in-out"
                    >
                        Send
                    </button>
                    <Script
                        src="https://www.google.com/recaptcha/api.js"
                    />
                    <div className="g-recaptcha self-center my-3" data-sitekey={process.env.NEXT_PUBLIC_RE_CAPTCHA_KEY} />
                    <ValidationError errors={state.errors} className="text-warning mt-2"/>
                    {
                        state.succeeded && <p className="text-success  mt-2">You have sent the email successfully</p>
                    }
                </form>
                {/*<div className="mt-auto mb-5">*/}
                {/*    <Image*/}
                {/*        src="/memoji/contact-memoji.PNG"*/}
                {/*        alt={"Contact Memoji"}*/}
                {/*        width={180}*/}
                {/*        height={180}*/}
                {/*        aria-label={"Contact Memoji"}*/}
                {/*    />*/}
                {/*</div>*/}
            </motion.div>
        </motion.div>
    )
}

import { FC } from "react";
import { useForm, ValidationError } from '@formspree/react';
import Image from "next/image";
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import {useAppDispatch} from "@/src/hooks/useAppDispatch";
import {activeActionIconSheet} from "@/store/modules/ActionSheet/actionSheet.slice";

export const Contact: FC = () => {
    const dispatch = useAppDispatch()
    const [state, handleSubmit] = useForm("mqknbjgw");
    return (
        <div className="w-[350px] h-[600px] flex flex-col justify-start items-center pb-3 px-3">
            <button
                aria-label={"Close contact"}
                onClick={() => dispatch(activeActionIconSheet())}
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
                />
                <h2 className="text-xl pb-2">Message</h2>
                <textarea
                    name="message"
                    className="w-full h-30 p-2 border-2 border-primary rounded-lg mb-4"
                    placeholder={'Your message'}
                    required
                />
                <ValidationError
                    prefix="Message"
                    field="message"
                    errors={state.errors}
                />
                <button
                    type="submit"
                    disabled={state.submitting}
                    className="self-center c-bg-gradient-green-to-purple w-[85px] h-10 rounded-full flex justify-center items-center text-white hover:scale-[1.05] transition ease-in-out"
                >
                    Send
                </button>
                <ValidationError errors={state.errors} className="text-warning mt-2"/>
            </form>
            <div className="mt-auto mb-5">
                <Image
                    src="/memoji/contact-memoji.PNG"
                    alt={"Contact Memoji"}
                    width={180}
                    height={180}
                    priority
                    aria-label={"Contact Memoji"}
                />
            </div>
        </div>
    )
}

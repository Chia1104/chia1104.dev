import { FC } from "react";
import { useForm, ValidationError } from '@formspree/react';

export const Contact: FC = () => {
    const [state, handleSubmit] = useForm("mqknbjgw");
    return (
        <form
            className="w-full h-full flex flex-col mx-auto"
            onSubmit={handleSubmit}>
            <h1>Contact</h1>
            <h2>Email</h2>
            <input
                type="email"
                name="email"
                className="w-full h-10 p-2 border-2 border-primary rounded-lg"
            />
            <ValidationError
                prefix="Email"
                field="email"
                errors={state.errors}
            />
            <h2>Message</h2>
            <textarea
                name="message"
                className="w-full h-30 p-2 border-2 border-primary rounded-lg"
            />
            <ValidationError
                prefix="Message"
                field="message"
                errors={state.errors}
            />
            <button type="submit" disabled={state.submitting}>
                Submit
            </button>
        </form>
    )
}

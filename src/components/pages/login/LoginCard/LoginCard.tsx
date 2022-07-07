import { FC, useState, useEffect, useId, FormEvent, useRef } from 'react';
import { login } from '@chia/lib/firebase/client/auth/services';
import {useSnackbar} from "notistack";
import { z } from 'zod';
import { useRouter } from 'next/router'

const LoginCard: FC = () => {
    const localState = {
        errors: {
            message: '',
        },
        succeeded: false,
        loading: false,
    }
    const loginSchema = z.object({
        email: z.string().email(),
        password: z.string().min(6).max(20),
    })

    const id = useId();
    const emailRef = useRef<HTMLInputElement>(null);
    const passwordRef = useRef<HTMLInputElement>(null);
    const [state, setState] = useState(localState);
    const { enqueueSnackbar } = useSnackbar();
    const router = useRouter()

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setState({ ...state, loading: true });
        const email = emailRef.current?.value;
        const password = passwordRef.current?.value;
        const isValid = loginSchema.safeParse({ email, password });
        if (!email || !password) {
            setState({ ...state, errors: { message: 'Email and password are required' }, loading: false });
            enqueueSnackbar(state.errors.message, { variant: 'error' });
            return;
        }
        if (!isValid.success) {
            setState({ ...state, errors: { message: 'Invalid email or password' }, loading: false });
            enqueueSnackbar(state.errors.message, { variant: 'error' });
            return;
        }
        try {
            const user = await login(email, password);
            if (!user) {
                setState({ ...state, errors: { message: 'Invalid email or password' }, loading: false });
                enqueueSnackbar(state.errors.message, { variant: 'error' });
                return;
            }
            setState({ ...state, succeeded: true, loading: false });
            enqueueSnackbar('Welcome Chia1104 | 俞又嘉', { variant: 'success' });
            if (state.succeeded) await router.push('/dashboard');
        } catch (e) {
            setState({ ...state, errors: { message: 'Login failed' }, loading: false });
            enqueueSnackbar(state.errors.message, { variant: 'error' });
        }
    }

    return (
        <main className="rounded-xl shadow-xl flex flex-col justify-center items-center c-bg-secondary w-full max-w-[900px] min-h-[500px] px-10">
            <h1 className="title mb-10 self-start">Login</h1>
            <form
                className="flex flex-col justify-center items-center w-full max-w-[400px]"
                onSubmit={(e) => handleSubmit(e)}>
                <div className="w-full mb-5">
                    <p className="subtitle mb-5">Email</p>
                    <input className="w-full rounded-lg p-2" type="email" placeholder="Email" ref={emailRef} required/>
                </div>
                <div className="w-full mb-5">
                    <p className="subtitle mb-5">Password</p>
                    <input className="w-full rounded-lg p-2" type="password" placeholder="Password" ref={passwordRef} required/>
                </div>
                <button
                    type="submit"
                    className="group hover:bg-secondary hover:dark:bg-primary relative inline-flex transition ease-in-out rounded self-center">
                    <span className="c-button-secondary transform group-hover:-translate-x-1 group-hover:-translate-y-1 text-base">
                       Login
                    </span>
                </button>
            </form>
        </main>
    );
}

export default LoginCard;

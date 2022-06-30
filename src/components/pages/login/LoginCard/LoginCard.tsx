import { FC, useState, useEffect, useId, FormEvent, useRef } from 'react';
import { login } from '@chia/lib/firebase/auth/services';
import {useSnackbar} from "notistack";

const LoginCard: FC = () => {
    const id = useId();
    const emailRef = useRef<HTMLInputElement>(null);
    const passwordRef = useRef<HTMLInputElement>(null);
    const localState = {
        errors: {},
        succeeded: false,
        loading: false,
    }
    const [state, setState] = useState(localState);
    const { enqueueSnackbar } = useSnackbar();

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setState({ ...state, loading: true });
        const email = emailRef.current?.value;
        const password = passwordRef.current?.value;
        if (!email || !password) {
            setState({ ...state, errors: { message: 'Email and password are required' }, loading: false });
            enqueueSnackbar('Email and password are required', { variant: 'error' });
            return;
        }
        try {
            const user = await login(email, password);
            if (!user) {
                setState({ ...state, errors: { message: 'Invalid email or password' }, loading: false });
                enqueueSnackbar('Invalid email or password', { variant: 'error' });
                return;
            }
            setState({ ...state, succeeded: true, loading: false });
            enqueueSnackbar('Login successful', { variant: 'success' });
        } catch (e) {
            setState({ ...state, errors: { message: e }, loading: false });
            enqueueSnackbar('Login failed', { variant: 'error' });
        }
    }

    return (
        <main className="rounded-xl shadow-xl flex flex-col justify-center items-center c-bg-secondary">
            <h1 className="title">Login</h1>
            <form onSubmit={(e) => handleSubmit(e)}>
                <div className="">
                    <label className="">Email</label>
                    <div className="">
                        <input className="" type="email" placeholder="Email" ref={emailRef}/>
                    </div>
                </div>
                <div className="">
                    <label className="">Password</label>
                    <div className="">
                        <input className="" type="password" placeholder="Password" ref={passwordRef}/>
                    </div>
                </div>
                <div className="">
                    <div className="">
                        <button className="" type="submit">Login</button>
                    </div>
                </div>
            </form>
        </main>
    );
}

export default LoginCard;

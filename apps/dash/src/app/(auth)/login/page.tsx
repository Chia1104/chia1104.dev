"use client";

import { signIn } from "next-auth/react";

const LoginPage = () => {
  return (
    <div>
      <h1>Login</h1>
      <button
        onClick={() =>
          signIn("google", {
            redirect: true,
            callbackUrl: "/",
          })
        }>
        Sign in
      </button>
    </div>
  );
};

export default LoginPage;

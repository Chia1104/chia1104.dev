import { ViewTransition } from "react";

import { LoginForm } from "@/components/auth/login-form";

export default function Page() {
  return (
    <ViewTransition>
      <LoginForm />
    </ViewTransition>
  );
}

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import "server-only";

import { authClient } from "@chia/auth/client";

import Form from "@/components/auth/form";

const LoginPage = async () => {
  const session = await authClient.getSession({
    fetchOptions: {
      headers: await headers(),
    },
  });
  if (session.data) {
    redirect("/");
  }
  return (
    <div className="c-container main">
      <Form />
    </div>
  );
};

export default LoginPage;

import { redirect } from "next/navigation";
import "server-only";

import { auth } from "@chia/auth";

import Form from "./form";

const LoginPage = async () => {
  const session = await auth();
  if (session) {
    redirect("/");
  }
  return (
    <div className="c-container main">
      <Form />
    </div>
  );
};

export default LoginPage;

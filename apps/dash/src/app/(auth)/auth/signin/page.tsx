import { redirect } from "next/navigation";
import "server-only";

import Form from "@/components/auth/form";
import { getSession } from "@/services/auth/resources.rsc";

const LoginPage = async () => {
  const session = await getSession();
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

import "server-only";

import { redirect } from "next/navigation";

import Form from "@/components/auth/form";
import { getSession } from "@/services/auth/resources.rsc";

const LoginPage = async () => {
  const session = await getSession();
  if (session.data) {
    redirect("/");
  }
  return (
    <div className="main container">
      <Form />
    </div>
  );
};

export default LoginPage;

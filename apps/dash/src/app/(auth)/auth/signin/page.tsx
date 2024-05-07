import Form from "./form";
import { auth } from "@chia/auth";
import { redirect } from "next/navigation";

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

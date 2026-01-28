import { redirect } from "next/navigation";

const Unauthorized = () => {
  redirect("/auth/login");
};

export default Unauthorized;

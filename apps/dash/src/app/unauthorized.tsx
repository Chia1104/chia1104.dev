import { redirect } from "next/navigation";

const Unauthorized = () => {
  redirect("/auth/signin");
};

export default Unauthorized;

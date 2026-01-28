import { redirect } from "next/navigation";

const Page = () => {
  redirect("feed/posts");
};

export default Page;

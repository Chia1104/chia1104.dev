import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";

const Page = async () => {
  const cookieStore = await cookies();
  const currentOrg = cookieStore.get("currentOrg");
  if (!currentOrg?.value) {
    notFound();
  }
  redirect(`/${currentOrg.value}/project`);
};

export default Page;

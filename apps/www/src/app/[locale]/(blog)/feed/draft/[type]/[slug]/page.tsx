import { draftMode } from "next/headers";
import { forbidden } from "next/navigation";

export default async function Page({
  params,
}: {
  params: Promise<{ type: "post" | "note"; slug: string }>;
}) {
  const { slug } = await params;
  const draft = await draftMode();
  if (!draft.isEnabled) {
    forbidden();
  }
  return <div>Draft: {slug}</div>;
}

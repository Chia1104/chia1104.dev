import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ViewTransition } from "react";

import { Logo } from "@/components/commons/logo";
import { getSession } from "@/services/auth/resources.rsc";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (session.data) {
    redirect("/");
  }

  return (
    <ViewTransition>
      <div className="grid min-h-svh lg:grid-cols-2">
        <div className="flex flex-col gap-4 p-6 md:p-10">
          <div className="flex justify-center gap-2 md:justify-start">
            <Link href="/" className="flex items-center gap-2 font-medium">
              <Logo />
            </Link>
          </div>
          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-xs">{children}</div>
          </div>
        </div>
        <div className="bg-muted relative hidden lg:block">
          <Image
            src="/feature-background.jpg"
            alt="Feature Background"
            fill
            className="h-full w-full object-cover"
          />
        </div>
      </div>
    </ViewTransition>
  );
}

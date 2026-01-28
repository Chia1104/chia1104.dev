"use client";

import dynamic from "next/dynamic";
import { ViewTransition } from "react";

const CreateForm = dynamic(() => import("@/components/feed/create-form"), {
  ssr: false,
});

export default function Page() {
  return (
    <ViewTransition>
      <section className="flex min-h-screen w-full justify-center">
        <div className="w-full max-w-4xl px-4 py-8 md:px-6 lg:px-8">
          <CreateForm />
        </div>
      </section>
    </ViewTransition>
  );
}

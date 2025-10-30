import { ViewTransition } from "react";

import AppLoading from "@/components/commons/app-loading";

export default function PostLoading() {
  return (
    <ViewTransition>
      <div className="flex flex-col h-screen w-full items-center justify-start">
        <AppLoading className="justify-start max-h-fit" />
      </div>
    </ViewTransition>
  );
}

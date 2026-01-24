import { ViewTransition } from "react";

import AppLoading from "@/components/commons/app-loading";

export default function PostLoading() {
  return (
    <ViewTransition>
      <div className="flex h-screen w-full flex-col items-center justify-start">
        <AppLoading className="max-h-fit justify-start" />
      </div>
    </ViewTransition>
  );
}

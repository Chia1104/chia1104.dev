import { ViewTransition } from "react";

import AppLoading from "@/components/commons/app-loading";

const Loading = () => {
  return (
    <ViewTransition>
      <div className="flex min-h-[calc(100vh-75px)] flex-col items-center justify-center">
        <AppLoading />
      </div>
    </ViewTransition>
  );
};

export default Loading;

import { ViewTransition } from "react";

import AppLoading from "@/components/commons/app-loading";

const Loading = () => {
  return (
    <ViewTransition>
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-75px)]">
        <AppLoading />
      </div>
    </ViewTransition>
  );
};

export default Loading;

import type { ReactNode } from "react";

import Background from "../components/commons/background";

const RootTemplate = ({ children }: { children: ReactNode }) => {
  return (
    <>
      <Background />
      {children}
    </>
  );
};

export default RootTemplate;

import { type ReactNode } from "react";
import Background from "./_components/background";

const RootTemplate = ({ children }: { children: ReactNode }) => {
  return (
    <>
      <Background />
      {children}
    </>
  );
};

export default RootTemplate;

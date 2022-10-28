import { type ReactNode } from "react";
import { Background, Footer } from "@chia/components/template";

const RootTemplate = ({ children }: { children: ReactNode }) => {
  return (
    <>
      <Background />
      {children}
      <Footer />
    </>
  );
};

export default RootTemplate;

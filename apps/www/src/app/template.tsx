import { type ReactNode } from "react";
import { Background, Footer } from "./components/index.ts";

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

import { type ReactNode } from "react";
import Background from "./background";
import Footer from "./footer";

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

import { type ReactNode } from "react";
import { Back } from "@chia/ui";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="c-container relative">
      <Back
        dirName="posts"
        className="c-bg-secondary absolute left-5 top-5 px-2"
        iconProps={{
          className: "w-5 h-5",
        }}
      />
      {children}
    </div>
  );
}

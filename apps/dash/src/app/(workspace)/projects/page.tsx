import { ViewTransition } from "react";

const Page = () => {
  return (
    <ViewTransition>
      <div className="container">
        <h2 className="text-2xl font-bold">Projects</h2>
      </div>
    </ViewTransition>
  );
};

export default Page;

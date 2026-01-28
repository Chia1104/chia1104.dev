import { ViewTransition } from "react";

const Page = () => {
  return (
    <ViewTransition>
      <div className="container">
        <h2 className="text-2xl font-bold">Api Keys</h2>
      </div>
    </ViewTransition>
  );
};

export default Page;

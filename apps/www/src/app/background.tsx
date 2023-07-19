import type { FC } from "react";

// test
const Background: FC = () => {
  return (
    <>
      <div className="from-bgPurple fixed -right-52 -top-20 -z-40 h-[600px] w-[600px] rounded-full bg-gradient-to-b blur-3xl" />
      <div className="from-bgBlue fixed -bottom-10 -left-20 -z-40 h-[350px] w-[350px] rounded-full bg-gradient-to-t blur-3xl" />
      <div className="c-background" />
    </>
  );
};

export default Background;

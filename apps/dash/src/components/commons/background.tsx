import type { FC } from "react";

const Background: FC = () => {
  return (
    <>
      <div className="from-bgPurple fixed -right-52 -top-20 -z-40 size-[600px] rounded-full bg-gradient-to-b blur-3xl" />
      <div className="from-bgBlue fixed -bottom-10 -left-20 -z-40 size-[350px] rounded-full bg-gradient-to-t blur-3xl" />
      <div className="c-background" />
    </>
  );
};

export default Background;

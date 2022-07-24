import { type FC } from "react";

export const Background: FC = () => {
  return (
    <>
      <div className="w-[600px] h-[600px] fixed -top-20 -right-52 -z-40 blur-3xl rounded-full bg-gradient-to-b from-bgPurple" />
      <div className="w-[350px] h-[350px] fixed -bottom-10 -left-20 -z-40 blur-3xl rounded-full bg-gradient-to-t from-bgBlue" />
    </>
  );
};

import { type FC } from "react";

interface Props {
  h?: number;
}

export const MDXSpacer: FC<Props> = ({ h = 4 }) => {
  return <div style={{ height: `${h}rem` }} />;
};

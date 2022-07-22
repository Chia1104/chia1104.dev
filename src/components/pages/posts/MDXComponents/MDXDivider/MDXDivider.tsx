import { Divider, Chip } from "@mui/material";
import { type FC } from "react";

interface Props {
  text: string;
}

export const MDXHr: FC = (props) => {
  return (
    <>
      <hr {...props} className="my-10 border-t-2 c-border-primary" />
    </>
  );
};

export const MDXDivider: FC<Props> = ({ text }) => {
  return (
    <>
      <Divider>
        <Chip label={text || "CHIP"} color={"info"} />
      </Divider>
    </>
  );
};

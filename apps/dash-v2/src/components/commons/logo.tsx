import { Avatar } from "@heroui/react";

interface Props {
  classNames?: {
    root?: string;
    image?: string;
    fallback?: string;
  };
}

export const Logo = ({ classNames }: Props) => {
  return (
    <Avatar className={classNames?.root}>
      <Avatar.Image src="/icon.png" className={classNames?.image} />
      <Avatar.Fallback className={classNames?.fallback}>
        <span>C</span>
      </Avatar.Fallback>
    </Avatar>
  );
};

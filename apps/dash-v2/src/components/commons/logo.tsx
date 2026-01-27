import { Avatar } from "@heroui/react";

export const Logo = () => {
  return (
    <Avatar>
      <Avatar.Image src="/icon.png" />
      <Avatar.Fallback>
        <span className="text-sm">C</span>
      </Avatar.Fallback>
    </Avatar>
  );
};

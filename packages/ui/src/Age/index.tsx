import { type FC, type ComponentPropsWithoutRef } from "react";
import dayjs from "dayjs";

interface Props extends ComponentPropsWithoutRef<"span"> {
  birthday: dayjs.Dayjs | string | number;
}

const Age: FC<Props> = ({ birthday, ...props }) => {
  return <span {...props}>{dayjs().diff(birthday, "year")}</span>;
};

export default Age;

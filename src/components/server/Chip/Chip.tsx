import { type FC } from "react";

interface Props {
  data: string[];
}

const Chip: FC<Props> = ({ data }) => {
  if (!data || data.length === 0) return null;

  return (
    <div className="flex mt-3 flex-wrap">
      {data.map((item, index) => (
        <div
          className="rounded-full c-border-primary border-2 c-bg-secondary mr-2 my-1"
          key={index}>
          <p className="text-center c-description px-2 text-base">
            {item || "Chip"}
          </p>
        </div>
      ))}
    </div>
  );
};

export default Chip;

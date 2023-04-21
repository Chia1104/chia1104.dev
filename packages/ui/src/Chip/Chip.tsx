"use client";

import React, { type FC } from "react";

interface Props {
  data?: string[];
}

const Chip: FC<Props> = ({ data }) => {
  if (!data || data.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap">
      {data.map((item, index) => (
        <div
          className="c-border-primary c-bg-secondary my-1 mr-2 rounded-full border-2"
          key={index}>
          <p className="c-description px-2 text-center text-base">
            {item || "Chip"}
          </p>
        </div>
      ))}
    </div>
  );
};

export default Chip;

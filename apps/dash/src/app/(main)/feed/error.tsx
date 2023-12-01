"use client";

import { withError } from "@chia/ui";

const Error = withError(
  ({ error }) => {
    return (
      <div className="c-container main">
        <div className="text-center">
          <h1 className="text-3xl font-bold">500 - {error?.name}</h1>
          <p className="text-xl font-bold">
            {error?.message ?? "Something went wrong."}
          </p>
        </div>
      </div>
    );
  },
  {
    onError(error) {
      console.error(error);
    },
  }
);

export default Error;

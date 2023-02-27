import type { NextPage } from "next";
import { useState } from "react";

const Test: NextPage = () => {
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount((prev) => prev + 1)}>Increment</button>
    </div>
  );
};

export default Test;

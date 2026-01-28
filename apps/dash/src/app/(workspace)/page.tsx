import { ViewTransition } from "react";

export default function Page() {
  return (
    <ViewTransition>
      <article className="container">
        <h2 className="text-2xl font-bold">Home</h2>
      </article>
    </ViewTransition>
  );
}

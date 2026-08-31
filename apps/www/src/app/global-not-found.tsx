"use client";

import "@total-typescript/ts-reset";
import "katex/dist/katex.css";
import "@/styles/globals.css";
import "react-medium-image-zoom/dist/styles.css";
import Error from "next/error";

export default function NotFound() {
  return (
    <html lang="en">
      <body>
        <Error statusCode={404} />
      </body>
    </html>
  );
}

import { ViewTransition } from "react";

import { SentSuccess } from "@/components/auth/sent-success";

export default function Page() {
  return (
    <ViewTransition>
      <SentSuccess />
    </ViewTransition>
  );
}

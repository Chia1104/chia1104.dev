import { ViewTransition } from "react";

import { ProjectsLoadingFallback } from "./loading-fallbacks";

export default function Loading() {
  return (
    <ViewTransition>
      <ProjectsLoadingFallback />
    </ViewTransition>
  );
}

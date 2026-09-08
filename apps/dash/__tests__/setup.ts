import { cleanup } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { afterEach } from "vitest";

// happy-dom rejects an animation's `finished` promise when Motion cancels it on unmount, which
// surfaces as an unhandled rejection. Jumping to the end state keeps the DOM assertions the same.
MotionGlobalConfig.skipAnimations = true;

afterEach(() => {
  cleanup();
});

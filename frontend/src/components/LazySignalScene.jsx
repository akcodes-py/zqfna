import { lazy, Suspense } from "react";

const SignalScene = lazy(() =>
  import("./SignalScene").then(({ SignalScene: Component }) => ({ default: Component }))
);

export function LazySignalScene({ mode }) {
  return (
    <Suspense fallback={<div className={`signal-scene signal-scene--${mode}`} aria-hidden="true" />}>
      <SignalScene mode={mode} />
    </Suspense>
  );
}

import type { ReactNode } from "react";

/** The shared loading, empty and error states, so every page reports them the same way. */

export function Loading({ children }: { children: ReactNode }) {
  return (
    <p className="state" role="status">
      <span className="spinner" aria-hidden="true" />
      {children}
    </p>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="state state-empty">{children}</p>;
}

export function ErrorState({ children }: { children: ReactNode }) {
  return (
    <p className="state state-error" role="alert">
      {children}
    </p>
  );
}

"use client";

import type { ReactNode } from "react";

type AnalyticsNavButtonProps = {
  href: string;
  className?: string;
  children: ReactNode;
};

export function AnalyticsNavButton({
  href,
  className,
  children,
}: AnalyticsNavButtonProps) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        window.location.assign(href);
      }}
    >
      {children}
    </button>
  );
}

"use client";

import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";
import { trackEvent } from "@/app/lib/analytics";

type GetStartedLinkProps = Omit<ComponentPropsWithoutRef<typeof Link>, "href"> & {
  location: string;
};

export default function GetStartedLink({ location, children, onClick, ...props }: GetStartedLinkProps) {
  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    trackEvent("get_started_clicked", { location });
    onClick?.(event);
  };

  return (
    <Link href="/app" onClick={handleClick} {...props}>
      {children}
    </Link>
  );
}

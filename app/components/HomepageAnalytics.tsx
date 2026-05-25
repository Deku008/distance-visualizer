"use client";

import { useEffect } from "react";
import { trackEventOnce } from "@/app/lib/analytics";

export default function HomepageAnalytics() {
  useEffect(() => {
    trackEventOnce("homepage_visit", "homepage_visit");
  }, []);

  return null;
}

"use client";

import { useEffect } from "react";

function isPageReload(): boolean {
  const nav = performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined;
  return nav?.type === "reload";
}

export function WindowCloseLogout() {
  useEffect(() => {
    function logoutOnClose() {
      if (isPageReload()) return;

      fetch("/api/auth/logout", {
        method: "POST",
        keepalive: true,
      }).catch(() => {
        // La pestaña puede cerrarse antes de completar la petición.
      });
    }

    function handlePageHide(event: PageTransitionEvent) {
      if (event.persisted) return;
      logoutOnClose();
    }

    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, []);

  return null;
}

"use client";

import { useEffect } from "react";

export default function PWA() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", async function () {
        await navigator.serviceWorker.register("/custom-sw.js");
      });
    }
  }, []);

  return <></>;
}

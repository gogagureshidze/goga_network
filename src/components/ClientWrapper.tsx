"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import PageTransition from "@/components/PageTransition";
import GlobalLoader from "@/components/GlobalLoader";

export default function ClientWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Show loader briefly on route change
    setLoading(true);
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 1000);
    return () => clearTimeout(timeout);
  }, [pathname, searchParams]);

  return (
    <>
      {loading && <GlobalLoader />}
      <PageTransition>{children}</PageTransition>
    </>
  );
}

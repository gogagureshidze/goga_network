"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import GlobalLoader from "@/components/GlobalLoader";
import PageTransition from "@/components/PageTransition";

export default function ClientWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);

    const timeout = setTimeout(() => {
      setLoading(false);
    }, 300);

    return () => clearTimeout(timeout);
  }, [pathname, searchParams]);

  return (
    <>
      <AnimatePresence mode="wait">
        {loading && (
          <motion.div
            key="global-loader"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[999] bg-orange-100/80 backdrop-blur-sm flex flex-col items-center justify-center gap-8"
          >
            <div className="loader-spinner" />
          </motion.div>
        )}
      </AnimatePresence>

      <PageTransition>{children}</PageTransition>
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

const GlobalLoader = () => {
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let timeout: NodeJS.Timeout;

    // Every time route changes, force loader first
    setLoading(true);

    // Wait a bit to simulate "page fully ready"
    timeout = setTimeout(() => {
      setLoading(false);
    }, 200);

    return () => clearTimeout(timeout);
  }, [pathname]);

  return (
    <AnimatePresence mode="wait">
      {loading && (
        <motion.div
          key="global-loader"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[999] bg-orange-100/80 dark:bg-gray-900/90 backdrop-blur-sm flex flex-col items-center justify-center gap-8 transition-colors"
        >
          {/* Fancy spinner */}
          <div className="loader-spinner dark:loader-spinner-dark" />

          {/* Optional: Glitchy text */}
          {/* <div className="loader-text dark:loader-text-dark" /> */}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GlobalLoader;

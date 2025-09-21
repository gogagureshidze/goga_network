"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

const GlobalLoader = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Show the loader immediately when the route starts changing
    setLoading(true);

    // This timeout is now much shorter, just long enough to ensure the animation starts
    // before the component unmounts. The actual "loading" state is now tied to
    // the completion of the page load itself, which happens naturally.
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 300); // 👈 Adjust this short duration for the exit animation feel

    return () => clearTimeout(timeout);
  }, [pathname, searchParams]);

  return (
    <AnimatePresence mode="wait">
      {loading && (
        <motion.div
          key="global-loader"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }} // Match the exit animation duration to the timeout
          className="fixed inset-0 z-[999] bg-orange-100/80 backdrop-blur-sm flex flex-col items-center justify-center gap-8"
        >
          {/* Fancy spinner */}
          <div className="loader-spinner" />

          {/* Glitchy text */}
          {/* <div className="loader-text" /> */}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GlobalLoader;

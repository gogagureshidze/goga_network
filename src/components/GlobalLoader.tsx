"use client";

import { AnimatePresence, motion } from "framer-motion";

const GlobalLoader = () => {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="global-loader"
        initial={{ opacity: 1 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-[999] bg-orange-100/80 backdrop-blur-sm flex flex-col items-center justify-center gap-8"
      >
        {/* Fancy spinner */}
        <div className="loader-spinner" />
      </motion.div>
    </AnimatePresence>
  );
};

export default GlobalLoader;

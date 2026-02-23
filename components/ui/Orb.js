"use client";

import { motion } from "framer-motion";

export function FloatingOrb() {
  return (
    <div className="pointer-events-none absolute left-1/2 top-[-100px] z-0 -translate-x-1/2 opacity-60">
      <motion.div
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.4, 0.6, 0.4],
          y: [0, -20, 0],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="h-[400px] w-[400px] rounded-full bg-[#A855F7] blur-[120px]"
      />
    </div>
  );
}

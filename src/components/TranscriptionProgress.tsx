"use client";

import { motion } from "framer-motion";

export default function TranscriptionProgress() {
  return (
    <motion.div
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 16, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 26 }}
      className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-surface border border-edge px-5 py-3 rounded-xl shadow-sm min-w-[260px]"
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
        className="w-4 h-4 border-2 border-edge border-t-accent rounded-full shrink-0"
      />
      <span className="text-sm text-ink-muted">Transcribing audio...</span>
    </motion.div>
  );
}

"use client";

import { motion } from "framer-motion";

interface UndoToastProps {
  noteTitle: string;
  onUndo: () => void;
  onDismiss: () => void;
}

export default function UndoToast({
  noteTitle,
  onUndo,
  onDismiss,
}: UndoToastProps) {
  const displayTitle =
    noteTitle.length > 24 ? noteTitle.slice(0, 24) + "\u2026" : noteTitle;

  return (
    <motion.div
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 16, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 26 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-surface border border-edge px-5 py-3 rounded-xl shadow-sm overflow-hidden min-w-[260px]"
    >
      <span className="text-sm text-ink-muted flex-1 truncate">
        <span className="font-hand text-base text-ink">
          {displayTitle || "Untitled"}
        </span>
        {" \u2003"}deleted
      </span>

      <button
        onClick={onUndo}
        className="text-sm text-accent hover:text-accent-hover transition-colors cursor-pointer shrink-0"
      >
        Undo
      </button>

      <button
        onClick={onDismiss}
        className="text-ink-muted/40 hover:text-ink-muted transition-colors cursor-pointer shrink-0"
        aria-label="Dismiss"
      >
        <svg
          className="w-3 h-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            d="M6 18L18 6M6 6l12 12"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {/* Progress bar */}
      <motion.div
        className="absolute bottom-0 left-0 h-px bg-edge"
        initial={{ width: "100%" }}
        animate={{ width: "0%" }}
        transition={{ duration: 7, ease: "linear" }}
      />
    </motion.div>
  );
}

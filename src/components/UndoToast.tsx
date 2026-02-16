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
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 20, opacity: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-ink text-bg px-4 py-3 rounded-xl shadow-lg overflow-hidden min-w-[280px]"
    >
      {/* Trash icon */}
      <svg
        className="w-4 h-4 shrink-0 opacity-60"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      <span className="text-sm flex-1 truncate">
        Deleted &ldquo;{displayTitle || "Untitled"}&rdquo;
      </span>

      <button
        onClick={onUndo}
        className="text-sm font-semibold text-accent hover:text-accent-hover transition-colors cursor-pointer shrink-0"
      >
        Undo
      </button>

      <button
        onClick={onDismiss}
        className="opacity-50 hover:opacity-100 transition-opacity cursor-pointer shrink-0"
        aria-label="Dismiss"
      >
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            d="M6 18L18 6M6 6l12 12"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {/* Progress bar */}
      <motion.div
        className="absolute bottom-0 left-0 h-0.5 bg-accent/60"
        initial={{ width: "100%" }}
        animate={{ width: "0%" }}
        transition={{ duration: 7, ease: "linear" }}
      />
    </motion.div>
  );
}

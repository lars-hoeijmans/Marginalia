"use client";

import { useCallback, useEffect } from "react";
import { motion } from "framer-motion";

interface OnboardingModalProps {
  onImport: (notes: Array<{ title: string; body: string }>) => void;
  onOpenAppleNotes: () => void;
  onClose: () => void;
}

export default function OnboardingModal({
  onImport,
  onOpenAppleNotes,
  onClose,
}: OnboardingModalProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleImportTextFiles = useCallback(async () => {
    if (!window.electron) return;
    const notes = await window.electron.importTextFiles();
    if (notes.length === 0) return;
    onImport(notes);
    onClose();
  }, [onImport, onClose]);

  const handleAppleNotes = useCallback(() => {
    onClose();
    onOpenAppleNotes();
  }, [onClose, onOpenAppleNotes]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-surface border border-edge rounded-2xl shadow-xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-edge-light">
          <h2 className="text-lg font-hand text-ink">Welcome to Marginalia</h2>
          <button
            onClick={onClose}
            className="text-ink-muted/50 hover:text-ink-muted transition-colors cursor-pointer p-1"
            aria-label="Close"
          >
            <svg
              className="w-4 h-4"
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
        </div>

        {/* Content */}
        <div className="px-5 py-4 space-y-4">
          <p className="text-sm text-ink-muted">
            A quiet space for your thoughts, notes, and ideas.
          </p>

          {/* Import section */}
          <div>
            <p className="px-3 pt-3 pb-1.5 text-xs font-medium text-ink-muted uppercase tracking-wide">
              Import existing notes
            </p>

            <button
              onClick={handleImportTextFiles}
              className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-surface-hover transition-colors cursor-pointer text-left"
            >
              <svg
                className="w-4 h-4 text-ink-muted shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="flex-1 text-sm text-ink">From text files</span>
              <svg
                className="w-4 h-4 text-ink-muted/50 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M9 5l7 7-7 7"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            <div className="mx-3 border-t border-edge-light" />

            <button
              onClick={handleAppleNotes}
              className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-surface-hover transition-colors cursor-pointer text-left"
            >
              <svg
                className="w-4 h-4 text-ink-muted shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M16.5 3C12.91 3 12 5.5 12 5.5S11.09 3 7.5 3C4.42 3 2 5.42 2 8.5c0 4.78 10 12.5 10 12.5s10-7.72 10-12.5C22 5.42 19.58 3 16.5 3z"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="flex-1 text-sm text-ink">
                From Apple Notes
              </span>
              <svg
                className="w-4 h-4 text-ink-muted/50 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M9 5l7 7-7 7"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            <p className="px-3 pb-3 pt-1 text-[11px] text-ink-muted/60">
              You can also do this later from the File menu.
            </p>
          </div>

          {/* Audio callout */}
          <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-surface-hover/50">
            <svg
              className="w-4 h-4 text-accent shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M19 10v2a7 7 0 0 1-14 0v-2"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M12 19v4m-4 0h8"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="text-xs text-ink-muted leading-relaxed">
              Marginalia can transcribe audio into notes, fully offline. Find it
              in the File menu.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end px-5 py-3 border-t border-edge-light">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors cursor-pointer"
          >
            Get started
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

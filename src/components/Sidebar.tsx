"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Note, relativeTime } from "@/lib/types";

interface SidebarProps {
  notes: Note[];
  selectedId: string | null;
  searchQuery: string;
  isSaving: boolean;
  onSelectNote: (id: string) => void;
  onCreateNote: () => void;
  onSetSearchQuery: (query: string) => void;
}

const listVariants = {
  show: {
    transition: { staggerChildren: 0.04 },
  },
} as const;

const cardVariants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 400, damping: 28 },
  },
  exit: {
    opacity: 0,
    x: -40,
    filter: "blur(4px)",
    transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] as const },
  },
};

export default function Sidebar({
  notes,
  selectedId,
  searchQuery,
  isSaving,
  onSelectNote,
  onCreateNote,
  onSetSearchQuery,
}: SidebarProps) {
  return (
    <motion.aside
      data-print-hide
      className="w-80 min-w-80 border-r border-edge flex flex-col bg-surface"
      initial={{ x: -320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
    >
      {/* Header */}
      <div className="p-5 pb-3 pt-10">
        <motion.div
          className="flex items-baseline gap-3"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: 0.2,
            type: "spring",
            stiffness: 300,
            damping: 25,
          }}
        >
          <h1 className="font-hand text-3xl text-ink tracking-wide">
            Marginalia
          </h1>
          <motion.span
            className="text-accent"
            animate={{ rotate: [0, 8, -4, 0] }}
            transition={{ delay: 0.6, duration: 0.6 }}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </motion.span>
        </motion.div>
        <motion.p
          className="text-xs text-ink-muted mt-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          {notes.length} note{notes.length !== 1 ? "s" : ""}
          <AnimatePresence>
            {isSaving && (
              <motion.span
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -4 }}
                transition={{ duration: 0.15 }}
                className="ml-2 inline-flex items-center gap-1"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                saving
              </motion.span>
            )}
          </AnimatePresence>
        </motion.p>
      </div>

      {/* Search */}
      <div className="px-4 pb-3">
        <motion.div
          className="relative"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-muted pointer-events-none"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <circle cx="11" cy="11" r="8" strokeWidth="2" />
            <path
              d="m21 21-4.35-4.35"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <input
            id="search-input"
            type="text"
            placeholder="Search notes&#8230; &#8984;K"
            value={searchQuery}
            onChange={(e) => onSetSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-bg border border-edge-light rounded-lg text-ink placeholder:text-ink-muted/60 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all duration-200"
          />
        </motion.div>
      </div>

      {/* Note list */}
      <motion.div
        className="flex-1 overflow-y-auto px-3 pb-3"
        variants={listVariants}
        initial="hidden"
        animate="show"
      >
        <AnimatePresence mode="popLayout">
          {notes.map((note) => {
            const isSelected = selectedId === note.id;
            return (
              <motion.button
                key={note.id}
                variants={cardVariants}
                exit="exit"
                layout
                onClick={() => onSelectNote(note.id)}
                whileHover={{ y: -1, transition: { type: "spring", stiffness: 400, damping: 20 } }}
                whileTap={{ scale: 0.98 }}
                className={`w-full text-left p-3 rounded-lg mb-1.5 cursor-pointer transition-colors duration-150 ${
                  isSelected
                    ? "bg-accent-light border border-accent/20"
                    : "hover:bg-surface-hover border border-transparent"
                }`}
              >
                <p
                  className={`font-hand text-xl leading-tight truncate ${
                    isSelected ? "text-accent" : "text-ink"
                  }`}
                >
                  {note.title || "Untitled"}
                </p>
                <p className="text-xs text-ink-muted mt-1 line-clamp-2 leading-relaxed">
                  {note.body || "Empty note"}
                </p>
                <p className="text-[10px] text-ink-muted/50 mt-1.5">
                  {relativeTime(note.updatedAt)}
                </p>
              </motion.button>
            );
          })}
        </AnimatePresence>

        {notes.length === 0 && searchQuery && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-sm text-ink-muted py-8"
          >
            No notes match &ldquo;{searchQuery}&rdquo;
          </motion.p>
        )}
      </motion.div>

      {/* New note button */}
      <div className="p-3 border-t border-edge-light">
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.97 }}
          onClick={onCreateNote}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors duration-150 cursor-pointer"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              d="M12 5v14M5 12h14"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          New Note
        </motion.button>
      </div>
    </motion.aside>
  );
}

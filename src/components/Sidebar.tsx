"use client";

import { useMemo } from "react";
import { AnimatePresence, motion, Reorder } from "framer-motion";
import { Note, relativeTime } from "@/lib/types";

interface SidebarProps {
  notes: Note[];
  selectedId: string | null;
  searchQuery: string;
  isSaving: boolean;
  theme: "light" | "dark";
  onSelectNote: (id: string) => void;
  onCreateNote: () => void;
  onSetSearchQuery: (query: string) => void;
  onTogglePin: (id: string) => void;
  onToggleTheme: () => void;
  onReorderNotes: (reordered: Note[]) => void;
}

interface NoteCardProps {
  note: Note;
  isSelected: boolean;
  onSelect: () => void;
  onTogglePin: (id: string) => void;
}

function NoteCard({ note, isSelected, onSelect, onTogglePin }: NoteCardProps) {
  return (
    <div className="relative group">
      <button
        onClick={onSelect}
        className={`w-full text-left p-3 rounded-lg cursor-pointer transition-colors duration-150 ${
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
      </button>

      {/* Pin button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onTogglePin(note.id);
        }}
        className={`absolute top-2 right-2 p-1 rounded-md transition-all duration-150 cursor-pointer ${
          note.pinned
            ? "opacity-100 text-accent"
            : "opacity-0 group-hover:opacity-100 text-ink-muted hover:text-accent"
        }`}
        title={note.pinned ? "Unpin note" : "Pin note"}
        aria-label={note.pinned ? "Unpin note" : "Pin note"}
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
          {note.pinned ? (
            <path
              d="M16 3a1 1 0 0 1 .707.293l4 4a1 1 0 0 1-.164 1.547l-3.454 2.3-.457 2.74a1 1 0 0 1-.283.546l-2.122 2.122a1 1 0 0 1-1.414 0L10.5 14.227l-4.273 4.273a1 1 0 0 1-1.414-1.414L9.086 12.8l-2.321-2.321a1 1 0 0 1 0-1.414l2.122-2.122a1 1 0 0 1 .546-.283l2.74-.457 2.3-3.454A1 1 0 0 1 16 3Z"
              fill="currentColor"
            />
          ) : (
            <path
              d="M16 3a1 1 0 0 1 .707.293l4 4a1 1 0 0 1-.164 1.547l-3.454 2.3-.457 2.74a1 1 0 0 1-.283.546l-2.122 2.122a1 1 0 0 1-1.414 0L10.5 14.227l-4.273 4.273a1 1 0 0 1-1.414-1.414L9.086 12.8l-2.321-2.321a1 1 0 0 1 0-1.414l2.122-2.122a1 1 0 0 1 .546-.283l2.74-.457 2.3-3.454A1 1 0 0 1 16 3Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          )}
        </svg>
      </button>
    </div>
  );
}

export default function Sidebar({
  notes,
  selectedId,
  searchQuery,
  isSaving,
  theme,
  onSelectNote,
  onCreateNote,
  onSetSearchQuery,
  onTogglePin,
  onToggleTheme,
  onReorderNotes,
}: SidebarProps) {
  const pinnedNotes = useMemo(() => notes.filter((n) => n.pinned), [notes]);
  const unpinnedNotes = useMemo(() => notes.filter((n) => !n.pinned), [notes]);

  const isDraggable = !searchQuery;

  const handlePinnedReorder = (reordered: Note[]) => {
    onReorderNotes([...reordered, ...unpinnedNotes]);
  };

  const handleUnpinnedReorder = (reordered: Note[]) => {
    onReorderNotes([...pinnedNotes, ...reordered]);
  };

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

          {/* Theme toggle */}
          <button
            onClick={onToggleTheme}
            className="ml-auto p-1.5 rounded-md text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors duration-150 cursor-pointer"
            title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
            aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
          >
            <AnimatePresence mode="wait" initial={false}>
              {theme === "light" ? (
                <motion.svg
                  key="moon"
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  initial={{ opacity: 0, rotate: -90 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  exit={{ opacity: 0, rotate: 90 }}
                  transition={{ duration: 0.2 }}
                >
                  <path
                    d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </motion.svg>
              ) : (
                <motion.svg
                  key="sun"
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  initial={{ opacity: 0, rotate: -90 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  exit={{ opacity: 0, rotate: 90 }}
                  transition={{ duration: 0.2 }}
                >
                  <path
                    d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </motion.svg>
              )}
            </AnimatePresence>
          </button>
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
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {/* Pinned section */}
        {pinnedNotes.length > 0 && (
          <>
            {isDraggable ? (
              <Reorder.Group
                axis="y"
                values={pinnedNotes}
                onReorder={handlePinnedReorder}
              >
                {pinnedNotes.map((note) => (
                  <Reorder.Item
                    key={note.id}
                    value={note}
                    as="div"
                    layout
                    whileDrag={{ scale: 1.02, boxShadow: "0 4px 20px rgba(0,0,0,0.12)" }}
                    className="mb-1.5"
                  >
                    <NoteCard
                      note={note}
                      isSelected={selectedId === note.id}
                      onSelect={() => onSelectNote(note.id)}
                      onTogglePin={onTogglePin}
                    />
                  </Reorder.Item>
                ))}
              </Reorder.Group>
            ) : (
              pinnedNotes.map((note) => (
                <motion.div
                  key={note.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -40, filter: "blur(4px)" }}
                  transition={{ type: "spring", stiffness: 400, damping: 28 }}
                  className="mb-1.5"
                >
                  <NoteCard
                    note={note}
                    isSelected={selectedId === note.id}
                    onSelect={() => onSelectNote(note.id)}
                    onTogglePin={onTogglePin}
                  />
                </motion.div>
              ))
            )}

            {/* Divider between pinned and unpinned */}
            {unpinnedNotes.length > 0 && (
              <div className="h-px bg-edge-light my-2" />
            )}
          </>
        )}

        {/* Unpinned section */}
        {isDraggable ? (
          <Reorder.Group
            axis="y"
            values={unpinnedNotes}
            onReorder={handleUnpinnedReorder}
          >
            <AnimatePresence mode="popLayout">
              {unpinnedNotes.map((note) => (
                <Reorder.Item
                  key={note.id}
                  value={note}
                  as="div"
                  layout
                  whileDrag={{ scale: 1.02, boxShadow: "0 4px 20px rgba(0,0,0,0.12)" }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -40, filter: "blur(4px)", transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } }}
                  transition={{ type: "spring", stiffness: 400, damping: 28 }}
                  className="mb-1.5"
                >
                  <NoteCard
                    note={note}
                    isSelected={selectedId === note.id}
                    onSelect={() => onSelectNote(note.id)}
                    onTogglePin={onTogglePin}
                  />
                </Reorder.Item>
              ))}
            </AnimatePresence>
          </Reorder.Group>
        ) : (
          <AnimatePresence mode="popLayout">
            {unpinnedNotes.map((note) => (
              <motion.div
                key={note.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -40, filter: "blur(4px)", transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
                className="mb-1.5"
              >
                <NoteCard
                  note={note}
                  isSelected={selectedId === note.id}
                  onSelect={() => onSelectNote(note.id)}
                  onTogglePin={onTogglePin}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        )}

        {notes.length === 0 && searchQuery && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-sm text-ink-muted py-8"
          >
            No notes match &ldquo;{searchQuery}&rdquo;
          </motion.p>
        )}
      </div>

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

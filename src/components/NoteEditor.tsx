"use client";

import { useCallback, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Note, relativeTime } from "@/lib/types";

interface NoteEditorProps {
  note: Note;
  onUpdate: (
    id: string,
    updates: Partial<Pick<Note, "title" | "body">>
  ) => void;
  onDelete: (id: string) => void;
  isSaving: boolean;
}

export default function NoteEditor({
  note,
  onUpdate,
  onDelete,
  isSaving,
}: NoteEditorProps) {
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const textarea = bodyRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = textarea.scrollHeight + "px";
    }
  }, []);

  // Auto-grow on content change
  useEffect(() => {
    adjustHeight();
  }, [note.body, adjustHeight]);

  // Auto-grow on mount (handles initial content)
  useEffect(() => {
    requestAnimationFrame(adjustHeight);
  }, [note.id, adjustHeight]);

  // Focus title on new empty notes
  useEffect(() => {
    if (!note.title && !note.body) {
      setTimeout(() => titleRef.current?.focus(), 300);
    }
    // Only run on note switch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id]);

  const wordCount = note.body.trim()
    ? note.body.trim().split(/\s+/).length
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="h-full flex flex-col"
    >
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-8 pt-12 pb-32 notebook-lines">
          {/* Title with animated underline */}
          <div className="relative mb-2">
            <input
              ref={titleRef}
              type="text"
              value={note.title}
              onChange={(e) => onUpdate(note.id, { title: e.target.value })}
              placeholder="Untitled"
              className="w-full font-hand text-5xl text-ink placeholder:text-ink-muted/30 bg-transparent border-none outline-none tracking-wide peer"
            />
            <motion.div
              className="h-px bg-accent/30"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{
                delay: 0.3,
                duration: 0.6,
                ease: [0.16, 1, 0.3, 1],
              }}
              style={{ transformOrigin: "left" }}
            />
          </div>

          {/* Metadata bar */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="flex items-center gap-3 text-xs text-ink-muted mb-8 pt-1"
          >
            <span>{relativeTime(note.updatedAt)}</span>
            <span className="text-edge">&middot;</span>
            <span>
              {wordCount} word{wordCount !== 1 ? "s" : ""}
            </span>

            {/* Save indicator */}
            <AnimatePresence>
              {isSaving && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-center gap-1.5"
                >
                  <span className="text-edge">&middot;</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                  <span>Saving</span>
                </motion.span>
              )}
            </AnimatePresence>

            {/* Delete button */}
            <div className="ml-auto">
              <motion.button
                whileTap={{ scale: 0.9 }}
                whileHover={{ color: "#C0392B" }}
                onClick={() => onDelete(note.id)}
                className="text-ink-muted/50 hover:text-danger transition-colors duration-150 p-1.5 rounded-md hover:bg-danger/5 cursor-pointer"
                title="Delete note"
              >
                <svg
                  className="w-4 h-4"
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
              </motion.button>
            </div>
          </motion.div>

          {/* Body */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <textarea
              ref={bodyRef}
              value={note.body}
              onChange={(e) => {
                onUpdate(note.id, { body: e.target.value });
                adjustHeight();
              }}
              placeholder="Start writing&#8230;"
              className="w-full font-body text-lg leading-[32px] text-ink placeholder:text-ink-muted/30 bg-transparent border-none outline-none resize-none min-h-[50vh]"
            />
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

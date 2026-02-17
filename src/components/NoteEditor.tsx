"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Note, relativeTime, stripHtml, plainTextToHtml } from "@/lib/types";
import ExportMenu from "./ExportMenu";

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
  const bodyRef = useRef<HTMLDivElement>(null);

  // Set body content when switching notes (not on every keystroke)
  useLayoutEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.innerHTML = plainTextToHtml(note.body);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id]);

  // Focus title on new empty notes
  useEffect(() => {
    if (!note.title && !note.body) {
      setTimeout(() => titleRef.current?.focus(), 300);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id]);

  const handleBodyInput = useCallback(() => {
    if (!bodyRef.current) return;
    onUpdate(note.id, { body: bodyRef.current.innerHTML });
  }, [note.id, onUpdate]);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      e.preventDefault();
      const html = e.clipboardData.getData("text/html");
      const plain = e.clipboardData.getData("text/plain");

      if (html) {
        // Parse and sanitize: keep only b, strong, i, em, u, br, div, p
        const doc = new DOMParser().parseFromString(html, "text/html");
        const allowed = new Set(["b", "strong", "i", "em", "u", "br", "div", "p"]);

        function sanitize(node: Node): DocumentFragment {
          const frag = document.createDocumentFragment();
          for (const child of Array.from(node.childNodes)) {
            if (child.nodeType === Node.TEXT_NODE) {
              frag.appendChild(document.createTextNode(child.textContent || ""));
            } else if (child.nodeType === Node.ELEMENT_NODE) {
              const el = child as Element;
              const tag = el.tagName.toLowerCase();
              if (allowed.has(tag)) {
                const clean = document.createElement(tag);
                clean.appendChild(sanitize(el));
                frag.appendChild(clean);
              } else {
                frag.appendChild(sanitize(el));
              }
            }
          }
          return frag;
        }

        const sanitized = sanitize(doc.body);
        const wrapper = document.createElement("div");
        wrapper.appendChild(sanitized);
        document.execCommand("insertHTML", false, wrapper.innerHTML);
      } else {
        document.execCommand("insertText", false, plain);
      }
    },
    []
  );

  const handleBodyKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === "b") {
        e.preventDefault();
        document.execCommand("bold");
      } else if (e.key === "i") {
        e.preventDefault();
        document.execCommand("italic");
      } else if (e.key === "u") {
        e.preventDefault();
        document.execCommand("underline");
      }
    },
    []
  );

  const [confirmDelete, setConfirmDelete] = useState(false);

  // Reset confirm state after timeout
  useEffect(() => {
    if (!confirmDelete) return;
    const timer = setTimeout(() => setConfirmDelete(false), 2000);
    return () => clearTimeout(timer);
  }, [confirmDelete]);

  const plainBody = stripHtml(note.body).trim();
  const wordCount = plainBody ? plainBody.split(/\s+/).length : 0;
  const isEmpty = !plainBody;

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
              maxLength={40}
              placeholder="Untitled"
              className="w-full font-hand text-5xl text-ink placeholder:text-ink-muted/30 bg-transparent border-none outline-none tracking-wide peer"
            />
            <motion.div
              data-print-hide
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
            data-print-hide
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

            {/* Export & Delete */}
            <div className="ml-auto flex items-center gap-1">
              <ExportMenu note={note} />
              <AnimatePresence mode="wait" initial={false}>
                {confirmDelete ? (
                  <motion.button
                    key="confirm"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.15 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => onDelete(note.id)}
                    className="text-danger text-[11px] font-medium px-2 py-1 rounded-md bg-danger/10 hover:bg-danger/15 transition-colors duration-150 cursor-pointer"
                  >
                    Sure?
                  </motion.button>
                ) : (
                  <motion.button
                    key="trash"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.15 }}
                    whileTap={{ scale: 0.9 }}
                    whileHover={{ color: "#C0392B" }}
                    onClick={() => setConfirmDelete(true)}
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
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Body */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="relative"
          >
            {isEmpty && (
              <span className="absolute top-0 left-0 font-body text-lg text-ink-muted/30 pointer-events-none select-none">
                Start writing&#8230;
              </span>
            )}
            <div
              ref={bodyRef}
              contentEditable
              onKeyDown={handleBodyKeyDown}
              onPaste={handlePaste}
              onInput={handleBodyInput}
              className="w-full font-body text-lg leading-[32px] text-ink bg-transparent border-none outline-none min-h-[50vh]"
            />
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

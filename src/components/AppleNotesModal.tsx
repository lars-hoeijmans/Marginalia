"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { AppleNoteEntry } from "@/lib/electron";

interface AppleNotesModalProps {
  onImport: (notes: Array<{ title: string; body: string }>) => void;
  onClose: () => void;
}

type ModalState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; notes: AppleNoteEntry[] }
  | { status: "importing" };

export default function AppleNotesModal({
  onImport,
  onClose,
}: AppleNotesModalProps) {
  const [state, setState] = useState<ModalState>({ status: "loading" });
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    let canceled = false;

    async function load() {
      try {
        const notes = await window.electron!.listAppleNotes();
        if (!canceled) {
          setState({ status: "ready", notes });
        }
      } catch (e) {
        if (!canceled) {
          setState({
            status: "error",
            message: (e as Error).message,
          });
        }
      }
    }

    load();
    return () => {
      canceled = true;
    };
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const grouped = useMemo(() => {
    if (state.status !== "ready") return new Map<string, AppleNoteEntry[]>();
    const map = new Map<string, AppleNoteEntry[]>();
    for (const note of state.notes) {
      const folder = note.folder || "Notes";
      if (!map.has(folder)) map.set(folder, []);
      map.get(folder)!.push(note);
    }
    return map;
  }, [state]);

  const allNoteIds = useMemo(() => {
    if (state.status !== "ready") return [] as string[];
    return state.notes.map((n) => n.id);
  }, [state]);

  const allSelected = selected.size > 0 && selected.size === allNoteIds.length;

  const toggleNote = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allNoteIds));
    }
  }, [allSelected, allNoteIds]);

  const handleImport = useCallback(async () => {
    if (selected.size === 0) return;
    setState({ status: "importing" });

    try {
      const bodies = await window.electron!.getAppleNoteBodies(
        Array.from(selected)
      );
      onImport(bodies.map((b) => ({ title: b.title, body: b.body })));
      onClose();
    } catch (e) {
      setState({
        status: "error",
        message: (e as Error).message,
      });
    }
  }, [selected, onImport, onClose]);

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

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
        className="w-full max-w-lg max-h-[80vh] bg-surface border border-edge rounded-2xl shadow-xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-edge-light">
          <h2 className="text-lg font-hand text-ink">Import from Apple Notes</h2>
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
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {state.status === "loading" && (
            <div className="flex items-center justify-center py-16">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                className="w-5 h-5 border-2 border-edge border-t-accent rounded-full"
              />
              <span className="ml-3 text-sm text-ink-muted">
                Loading notes...
              </span>
            </div>
          )}

          {state.status === "importing" && (
            <div className="flex items-center justify-center py-16">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                className="w-5 h-5 border-2 border-edge border-t-accent rounded-full"
              />
              <span className="ml-3 text-sm text-ink-muted">
                Importing {selected.size} note{selected.size !== 1 && "s"}...
              </span>
            </div>
          )}

          {state.status === "error" && (
            <div className="py-12 text-center">
              <p className="text-sm text-danger mb-2">
                Could not access Apple Notes
              </p>
              <p className="text-xs text-ink-muted max-w-xs mx-auto">
                {state.message}
              </p>
              <button
                onClick={onClose}
                className="mt-4 text-sm text-accent hover:text-accent-hover transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          )}

          {state.status === "ready" && state.notes.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-sm text-ink-muted">
                No notes found in Apple Notes.
              </p>
            </div>
          )}

          {state.status === "ready" && state.notes.length > 0 && (
            <>
              {/* Select all toggle */}
              <button
                onClick={toggleAll}
                className="text-xs text-accent hover:text-accent-hover transition-colors cursor-pointer mb-3"
              >
                {allSelected ? "Deselect all" : "Select all"}
              </button>

              {Array.from(grouped.entries()).map(([folder, notes]) => (
                <div key={folder} className="mb-4">
                  <p className="text-xs font-medium text-ink-muted uppercase tracking-wide mb-1.5">
                    {folder}
                  </p>
                  <div className="space-y-1">
                    {notes.map((note) => (
                      <label
                        key={note.id}
                        className="flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-surface-hover transition-colors cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(note.id)}
                          onChange={() => toggleNote(note.id)}
                          className="mt-0.5 accent-accent cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-ink truncate">
                            {note.name}
                          </p>
                          <p className="text-xs text-ink-muted truncate">
                            {formatDate(note.modifiedDate)}
                            {note.preview && ` \u2014 ${note.preview}`}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        {state.status === "ready" && state.notes.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-edge-light">
            <span className="text-xs text-ink-muted">
              {selected.size} selected
            </span>
            <button
              onClick={handleImport}
              disabled={selected.size === 0}
              className="px-4 py-1.5 text-sm rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Import selected
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

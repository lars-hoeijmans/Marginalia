"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNotes } from "@/hooks/useNotes";
import Sidebar from "./Sidebar";
import NoteEditor from "./NoteEditor";
import EmptyState from "./EmptyState";

export default function App() {
  const {
    notes,
    selectedNote,
    selectedId,
    filteredNotes,
    searchQuery,
    isSaving,
    isLoaded,
    selectNote,
    createNote,
    updateNote,
    deleteNote,
    setSearchQuery,
  } = useNotes();

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key === "n") {
        e.preventDefault();
        createNote();
      }

      if (mod && e.key === "k") {
        e.preventDefault();
        document.getElementById("search-input")?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [createNote]);

  // Loading state
  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="font-hand text-4xl text-ink-muted"
        >
          Marginalia
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <Sidebar
        notes={filteredNotes}
        selectedId={selectedId}
        searchQuery={searchQuery}
        isSaving={isSaving}
        onSelectNote={selectNote}
        onCreateNote={createNote}
        onSetSearchQuery={setSearchQuery}
      />

      <main className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {selectedNote ? (
            <NoteEditor
              key={selectedNote.id}
              note={selectedNote}
              onUpdate={updateNote}
              onDelete={deleteNote}
              isSaving={isSaving}
            />
          ) : (
            <EmptyState
              key="empty"
              onCreateNote={createNote}
              hasNotes={notes.length > 0}
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

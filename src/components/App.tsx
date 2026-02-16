"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNotes } from "@/hooks/useNotes";
import { useTheme } from "@/hooks/useTheme";
import Sidebar from "./Sidebar";
import NoteEditor from "./NoteEditor";
import EmptyState from "./EmptyState";
import UndoToast from "./UndoToast";

export default function App() {
  const {
    notes,
    selectedNote,
    selectedId,
    filteredNotes,
    searchQuery,
    isSaving,
    isLoaded,
    pendingDelete,
    selectNote,
    createNote,
    updateNote,
    deleteNote,
    undoDelete,
    dismissDelete,
    togglePin,
    reorderNotes,
    setSearchQuery,
  } = useNotes();

  const { theme, toggleTheme, isThemeLoaded } = useTheme();

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

      if (mod && e.key === "z" && pendingDelete) {
        e.preventDefault();
        undoDelete();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [createNote, pendingDelete, undoDelete]);

  // Loading state
  if (!isLoaded || !isThemeLoaded) {
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
        theme={theme}
        onSelectNote={selectNote}
        onCreateNote={createNote}
        onSetSearchQuery={setSearchQuery}
        onTogglePin={togglePin}
        onToggleTheme={toggleTheme}
        onReorderNotes={reorderNotes}
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

      <AnimatePresence>
        {pendingDelete && (
          <UndoToast
            key={pendingDelete.note.id}
            noteTitle={pendingDelete.note.title}
            onUndo={undoDelete}
            onDismiss={dismissDelete}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNotes } from "@/hooks/useNotes";
import { useTheme } from "@/hooks/useTheme";
import Sidebar from "./Sidebar";
import NoteEditor from "./NoteEditor";
import EmptyState from "./EmptyState";
import UndoToast from "./UndoToast";
import AppleNotesModal from "./AppleNotesModal";
import WhisperSetupModal from "./WhisperSetupModal";
import SettingsModal from "./SettingsModal";
import TranscriptionProgress from "./TranscriptionProgress";
import OnboardingModal from "./OnboardingModal";

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
    importNotes,
    setSearchQuery,
  } = useNotes();

  const { theme, toggleTheme, isThemeLoaded } = useTheme();

  const [appleNotesOpen, setAppleNotesOpen] = useState(false);
  const [whisperSetupOpen, setWhisperSetupOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(
    () => typeof window !== "undefined" && !localStorage.getItem("marginalia-onboarding-seen")
  );

  const closeAppleNotes = useCallback(() => setAppleNotesOpen(false), []);
  const closeWhisperSetup = useCallback(() => setWhisperSetupOpen(false), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  const closeOnboarding = useCallback(() => {
    localStorage.setItem("marginalia-onboarding-seen", "1");
    setOnboardingOpen(false);
  }, []);

  const pickAndTranscribe = useCallback(async () => {
    if (!window.electron) return;

    const filePath = await window.electron.pickAudioFile();
    if (!filePath) return;

    setTranscribing(true);
    try {
      const result = await window.electron.transcribeAudio(filePath);
      importNotes([result]);
    } catch {
      // Transcription failed — progress toast will dismiss
    } finally {
      setTranscribing(false);
    }
  }, [importNotes]);

  // Electron IPC listeners
  useEffect(() => {
    if (!window.electron) return;

    const removeImport = window.electron.onImportNotes((notes) => {
      importNotes(notes);
    });

    const removeModal = window.electron.onOpenAppleNotesModal(() => {
      setAppleNotesOpen(true);
    });

    const removeWhisperSetup = window.electron.onOpenWhisperSetup(() => {
      setWhisperSetupOpen(true);
    });

    const removeOpenSettings = window.electron.onOpenSettings(() => {
      setSettingsOpen(true);
    });

    const removePickAndTranscribe = window.electron.onPickAndTranscribeAudio(() => {
      pickAndTranscribe();
    });

    const removeOpenOnboarding = window.electron.onOpenOnboarding(() => {
      setOnboardingOpen(true);
    });

    const removeExportNotes = window.electron.onExportNotes(() => {
      window.electron!.exportNotes();
    });

    return () => {
      removeImport();
      removeModal();
      removeWhisperSetup();
      removeOpenSettings();
      removePickAndTranscribe();
      removeOpenOnboarding();
      removeExportNotes();
    };
  }, [importNotes, pickAndTranscribe]);

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

      <main className="relative flex-1 overflow-hidden">
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

        <AnimatePresence>
          {transcribing && <TranscriptionProgress key="transcription" />}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {appleNotesOpen && (
          <AppleNotesModal
            key="apple-notes"
            onImport={importNotes}
            onClose={closeAppleNotes}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {settingsOpen && (
          <SettingsModal key="settings" onClose={closeSettings} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {whisperSetupOpen && (
          <WhisperSetupModal
            key="whisper-setup"
            onComplete={() => {
              setWhisperSetupOpen(false);
              pickAndTranscribe();
            }}
            onClose={closeWhisperSetup}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {onboardingOpen && (
          <OnboardingModal
            key="onboarding"
            onImport={importNotes}
            onOpenAppleNotes={() => setAppleNotesOpen(true)}
            onClose={closeOnboarding}
          />
        )}
      </AnimatePresence>

    </div>
  );
}

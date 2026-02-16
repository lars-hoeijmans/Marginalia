"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Note } from "@/lib/types";

const STORAGE_KEY = "marginalia-notes";
const SAVE_DELAY = 600;

const defaultNotes: Note[] = [
  {
    id: "welcome",
    title: "Welcome to Marginalia",
    body: "This is your space for thinking. A quiet corner where ideas can grow, evolve, and connect.\n\nTry creating a new note with the button below, or press \u2318N. Search your notes with \u2318K.\n\nEvery interaction in this app is animated with spring physics and careful easing \u2014 notice how things move with weight and intention.",
    createdAt: Date.now() - 172800000,
    updatedAt: Date.now() - 172800000,
  },
  {
    id: "notation",
    title: "On the Art of Notation",
    body: "The best notes aren\u2019t transcriptions \u2014 they\u2019re translations. You take a raw thought and give it just enough structure to survive the passage of time.\n\nMarginal notes, or marginalia, were how the greatest thinkers processed ideas. They read, they reacted, they wrote in the margins. This app is built in that spirit.\n\nWrite freely. Edit ruthlessly. Let your ideas breathe.",
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 86400000,
  },
  {
    id: "spring",
    title: "Spring Physics",
    body: "Notice how elements in this app move. Nothing stops abruptly. Nothing starts from zero.\n\nEvery animation uses spring physics \u2014 slight overshoot, natural settling, like objects with mass. The sidebar slides in with weight. Cards lift with intention. Transitions breathe.\n\nGood animation is invisible. You don\u2019t see it \u2014 you feel it.",
    createdAt: Date.now() - 43200000,
    updatedAt: Date.now() - 43200000,
  },
];

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: Note[] = JSON.parse(stored);
        setNotes(parsed);
        if (parsed.length > 0) setSelectedId(parsed[0].id);
      } else {
        setNotes(defaultNotes);
        setSelectedId(defaultNotes[0].id);
      }
    } catch {
      setNotes(defaultNotes);
      setSelectedId(defaultNotes[0].id);
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  const persist = useCallback((updated: Note[]) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setIsSaving(true);
    saveTimeoutRef.current = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setIsSaving(false);
    }, SAVE_DELAY);
  }, []);

  const selectedNote = notes.find((n) => n.id === selectedId) ?? null;

  const filteredNotes = searchQuery
    ? notes.filter(
        (n) =>
          n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          n.body.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : notes;

  const createNote = useCallback(() => {
    const newNote: Note = {
      id: crypto.randomUUID(),
      title: "",
      body: "",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const updated = [newNote, ...notes];
    setNotes(updated);
    setSelectedId(newNote.id);
    setSearchQuery("");
    persist(updated);
  }, [notes, persist]);

  const updateNote = useCallback(
    (id: string, updates: Partial<Pick<Note, "title" | "body">>) => {
      setNotes((prev) => {
        const updated = prev.map((n) =>
          n.id === id ? { ...n, ...updates, updatedAt: Date.now() } : n
        );
        persist(updated);
        return updated;
      });
    },
    [persist]
  );

  const deleteNote = useCallback(
    (id: string) => {
      const idx = notes.findIndex((n) => n.id === id);
      const updated = notes.filter((n) => n.id !== id);
      setNotes(updated);
      persist(updated);

      if (selectedId === id) {
        const newIdx = Math.min(idx, updated.length - 1);
        setSelectedId(updated[newIdx]?.id ?? null);
      }
    },
    [notes, selectedId, persist]
  );

  return {
    notes,
    selectedNote,
    selectedId,
    filteredNotes,
    searchQuery,
    isSaving,
    isLoaded,
    selectNote: setSelectedId,
    createNote,
    updateNote,
    deleteNote,
    setSearchQuery,
  };
}

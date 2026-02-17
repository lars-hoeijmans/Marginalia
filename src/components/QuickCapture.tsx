"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion } from "framer-motion";

export default function QuickCapture() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  const wordCount = useMemo(() => {
    const text = `${title} ${body}`.trim();
    if (!text) return 0;
    return text.split(/\s+/).length;
  }, [title, body]);

  const canSave = title.trim().length > 0 || body.trim().length > 0;

  const save = useCallback(() => {
    if (!canSave) return;
    window.electron?.quickCaptureSave({
      title: title.trim(),
      body: body.trim(),
    });
    setTitle("");
    setBody("");
  }, [title, body, canSave]);

  const dismiss = useCallback(() => {
    window.electron?.quickCaptureDismiss();
  }, []);

  // Make background transparent for macOS rounded corners
  useEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
  }, []);

  // Listen for reset signal when popup is re-shown
  useEffect(() => {
    if (!window.electron?.onQuickCaptureReset) return;
    return window.electron.onQuickCaptureReset(() => {
      setTitle("");
      setBody("");
      titleRef.current?.focus();
    });
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        dismiss();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        save();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [save, dismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: -8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", damping: 28, stiffness: 400 }}
      className="h-screen w-screen"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      <div
        className="h-full rounded-xl bg-surface/80 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <div className="px-4 pt-4 pb-2">
          <input
            ref={titleRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={40}
            placeholder="Note title"
            autoFocus
            className="w-full font-hand text-2xl text-ink placeholder:text-ink-muted/40 bg-transparent border-none outline-none tracking-wide"
          />
        </div>

        <div className="flex-1 px-4 pb-2 min-h-0">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Start writing..."
            className="w-full h-full font-body text-base text-ink placeholder:text-ink-muted/30 bg-transparent border-none outline-none resize-none leading-relaxed"
          />
        </div>

        <div className="px-4 py-2.5 border-t border-edge-light flex items-center justify-between text-xs text-ink-muted">
          <div className="flex items-center gap-3">
            <span>{wordCount} {wordCount === 1 ? "word" : "words"}</span>
            <span className="opacity-50">Esc to dismiss</span>
          </div>
          <button
            onClick={save}
            disabled={!canSave}
            className="px-3 py-1 rounded-md bg-accent text-white text-xs font-medium disabled:opacity-30 hover:bg-accent-hover transition-colors"
          >
            Save
            <span className="ml-1.5 opacity-70">&#8984;&#9166;</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}

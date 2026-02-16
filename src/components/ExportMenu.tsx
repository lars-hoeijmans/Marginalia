"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Note } from "@/lib/types";

interface ExportMenuProps {
  note: Note;
}

function sanitizeFilename(title: string): string {
  const name = title.trim() || "Untitled";
  return name.replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\s+/g, "-");
}

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function ExportMenu({ note }: ExportMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    if (!isOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [isOpen, close]);

  const filename = sanitizeFilename(note.title);

  const exportTxt = () => {
    const content = `${note.title}\n\n${note.body}`;
    downloadBlob(content, `${filename}.txt`, "text/plain");
    close();
  };

  const exportMd = () => {
    const content = `# ${note.title}\n\n${note.body}`;
    downloadBlob(content, `${filename}.md`, "text/markdown");
    close();
  };

  const exportPdf = () => {
    close();
    window.print();
  };

  return (
    <div ref={menuRef} className="relative">
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen((prev) => !prev)}
        className="text-ink-muted/50 hover:text-ink-muted transition-colors duration-150 p-1.5 rounded-md hover:bg-surface-hover cursor-pointer"
        title="Export note"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            d="M9 8.25H7.5a2.25 2.25 0 0 0-2.25 2.25v9a2.25 2.25 0 0 0 2.25 2.25h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25H15m0-3-3-3m0 0-3 3m3-3V15"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-full mt-1 bg-surface border border-edge rounded-lg shadow-lg py-1 min-w-[160px] z-50"
          >
            <button
              onClick={exportTxt}
              className="w-full text-left px-3 py-2 text-sm text-ink hover:bg-surface-hover transition-colors duration-100 cursor-pointer flex items-center gap-2"
            >
              <span className="text-ink-muted text-xs font-mono w-8">.txt</span>
              Plain Text
            </button>
            <button
              onClick={exportMd}
              className="w-full text-left px-3 py-2 text-sm text-ink hover:bg-surface-hover transition-colors duration-100 cursor-pointer flex items-center gap-2"
            >
              <span className="text-ink-muted text-xs font-mono w-8">.md</span>
              Markdown
            </button>
            <div className="h-px bg-edge-light mx-2 my-1" />
            <button
              onClick={exportPdf}
              className="w-full text-left px-3 py-2 text-sm text-ink hover:bg-surface-hover transition-colors duration-100 cursor-pointer flex items-center gap-2"
            >
              <svg
                className="w-3.5 h-3.5 text-ink-muted"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m0 0a48.394 48.394 0 0 1 10.5 0m-10.5 0V5.625c0-.621.504-1.125 1.125-1.125h8.25c.621 0 1.125.504 1.125 1.125v2.034"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Print / PDF
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

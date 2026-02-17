"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";

interface WhisperSetupModalProps {
  onComplete: () => void;
  onClose: () => void;
}

interface DownloadProgress {
  percent: number;
  downloadedMB: number;
  totalMB: number;
}

type ModalState =
  | { status: "choosing" }
  | { status: "downloading"; progress: DownloadProgress }
  | { status: "done" };

const MODELS = [
  {
    filename: "ggml-large-v3-turbo-q5_0.bin",
    label: "Large (Turbo)",
    size: "~574 MB",
    description:
      "Near-perfect accuracy, optimized for Apple Silicon. Best for non-English languages, accented speech, and background noise.",
    recommended: true,
  },
  {
    filename: "ggml-base-q5_1.bin",
    label: "Base",
    size: "~60 MB",
    description:
      "Good accuracy for clear speech in quiet environments. Faster download, lighter on disk.",
    recommended: false,
  },
] as const;

export default function WhisperSetupModal({
  onComplete,
  onClose,
}: WhisperSetupModalProps) {
  const [state, setState] = useState<ModalState>({ status: "choosing" });
  const [selectedModel, setSelectedModel] = useState<string>(MODELS[0].filename);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!window.electron) return;
    return window.electron.onWhisperDownloadProgress((progress) => {
      setState({ status: "downloading", progress });
    });
  }, []);

  // Close on Escape (only when not downloading)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && state.status !== "downloading") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, state.status]);

  const handleDownload = useCallback(async () => {
    setError(null);
    setState({
      status: "downloading",
      progress: { percent: 0, downloadedMB: 0, totalMB: 0 },
    });

    try {
      await window.electron!.downloadWhisperModel(selectedModel);
      setState({ status: "done" });
      onComplete();
    } catch (e) {
      setState({ status: "choosing" });
      setError((e as Error).message);
    }
  }, [selectedModel, onComplete]);

  const canClose = state.status !== "downloading";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={canClose ? onClose : undefined}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-surface border border-edge rounded-2xl shadow-xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-edge-light">
          <h2 className="text-lg font-hand text-ink">Set up audio import</h2>
          {canClose && (
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
          )}
        </div>

        {/* Content */}
        <div className="px-5 py-4 space-y-4">
          {/* Privacy callout */}
          <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-surface-hover/50">
            <svg
              className="w-4 h-4 text-accent shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M12 15v.01M12 12V8m0 14a10 10 0 1 1 0-20 10 10 0 0 1 0 20z"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="text-xs text-ink-muted leading-relaxed">
              Transcription is fully offline, fully local, and fully safe.
              Nothing ever leaves your device.
            </p>
          </div>

          {state.status === "choosing" && (
            <>
              <p className="text-sm text-ink-muted">
                Choose a transcription model to download:
              </p>

              <div className="space-y-2">
                {MODELS.map((model) => (
                  <label
                    key={model.filename}
                    className={`flex items-start gap-3 px-3 py-3 rounded-xl border transition-colors cursor-pointer ${
                      selectedModel === model.filename
                        ? "border-accent bg-accent/5"
                        : "border-edge hover:border-edge-light"
                    }`}
                  >
                    <input
                      type="radio"
                      name="whisper-model"
                      value={model.filename}
                      checked={selectedModel === model.filename}
                      onChange={() => setSelectedModel(model.filename)}
                      className="mt-1 accent-accent cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-medium text-ink">
                          {model.label}
                        </span>
                        <span className="text-xs text-ink-muted">
                          {model.size}
                        </span>
                        {model.recommended && (
                          <span className="text-[10px] font-medium text-accent bg-accent/10 px-1.5 py-0.5 rounded-full">
                            Recommended
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-ink-muted mt-0.5">
                        {model.description}
                      </p>
                    </div>
                  </label>
                ))}
              </div>

              {error && (
                <p className="text-xs text-danger">{error}</p>
              )}
            </>
          )}

          {state.status === "downloading" && (
            <div className="space-y-3">
              <p className="text-sm text-ink-muted">
                Downloading model...
              </p>
              <div className="h-2 rounded-full bg-edge overflow-hidden">
                <motion.div
                  className="h-full bg-accent rounded-full"
                  initial={{ width: "0%" }}
                  animate={{
                    width: `${state.progress.percent}%`,
                  }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                />
              </div>
              <p className="text-xs text-ink-muted text-center">
                {state.progress.downloadedMB} / {state.progress.totalMB} MB
                ({state.progress.percent}%)
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        {state.status === "choosing" && (
          <div className="flex justify-end px-5 py-3 border-t border-edge-light">
            <button
              onClick={handleDownload}
              className="px-4 py-1.5 text-sm rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors cursor-pointer"
            >
              Download
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

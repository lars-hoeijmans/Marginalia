"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { AppSettings, ElectronAPI, QuickCapturePosition, WhisperModelInfo } from "@/lib/electron";

interface SettingsModalProps {
  onClose: () => void;
}

interface DownloadProgress {
  percent: number;
  downloadedMB: number;
  totalMB: number;
}

interface WhisperBuildToolsStatus {
  supported: boolean;
  ok: boolean;
  missing: string[];
}

interface WhisperRebuildProgress {
  line: string;
  stream: "stdout" | "stderr";
}

interface WhisperRebuildResult {
  success: boolean;
  error?: string;
}

type WhisperElectronAPI = ElectronAPI & {
  checkWhisperBuildTools: () => Promise<WhisperBuildToolsStatus>;
  rebuildWhisper: () => Promise<WhisperRebuildResult>;
  onWhisperRebuildProgress: (
    callback: (progress: WhisperRebuildProgress) => void
  ) => () => void;
};

type RebuildState = "idle" | "checking" | "rebuilding" | "success";

function getWhisperBuildToolsMessage(status: WhisperBuildToolsStatus): string {
  if (!status.supported) return "Whisper rebuild is only available on macOS.";
  if (status.missing.includes("Xcode Command Line Tools")) {
    return "Xcode Command Line Tools required. Run: xcode-select --install";
  }
  return `Missing build tools: ${status.missing.join(", ")}`;
}

function formatShortcut(shortcut: string): string {
  return shortcut
    .replace("CommandOrControl", "\u2318")
    .replace("Shift", "\u21E7")
    .replace("Alt", "\u2325")
    .replace("Control", "\u2303")
    .replace(/\+/g, " ");
}

function codeToKey(code: string): string | null {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  const map: Record<string, string> = {
    Space: "Space", Minus: "-", Equal: "=", BracketLeft: "[", BracketRight: "]",
    Backslash: "\\", Semicolon: ";", Quote: "'", Comma: ",", Period: ".",
    Slash: "/", Backquote: "`", Enter: "Return", Backspace: "Backspace",
    Tab: "Tab", Escape: "Escape", ArrowUp: "Up", ArrowDown: "Down",
    ArrowLeft: "Left", ArrowRight: "Right", Delete: "Delete",
  };
  if (code.startsWith("F") && /^F\d+$/.test(code)) return code;
  return map[code] ?? null;
}

function keyEventToShortcut(e: KeyboardEvent): string | null {
  if (["Meta", "Shift", "Alt", "Control"].includes(e.key)) return null;

  const parts: string[] = [];
  if (e.metaKey) parts.push("CommandOrControl");
  if (e.ctrlKey && !e.metaKey) parts.push("CommandOrControl");
  if (e.shiftKey) parts.push("Shift");
  if (e.altKey) parts.push("Alt");

  // Require Cmd/Ctrl for global shortcuts
  if (!e.metaKey && !e.ctrlKey) return null;
  if (parts.length < 2) return null;

  const key = codeToKey(e.code);
  if (!key) return null;
  parts.push(key);
  return parts.join("+");
}

const POSITIONS: QuickCapturePosition[] = [
  "top-left",    "top-center",    "top-right",
  "center-left", "center",        "center-right",
  "bottom-left", "bottom-center", "bottom-right",
];

interface PositionPickerProps {
  value: QuickCapturePosition;
  disabled: boolean;
  onChange: (position: QuickCapturePosition) => void;
}

function PositionPicker({ value, disabled, onChange }: PositionPickerProps) {
  return (
    <div
      className={`relative w-[160px] h-[100px] rounded-lg border border-edge bg-surface-hover/40 transition-opacity ${
        disabled ? "opacity-40 pointer-events-none" : ""
      }`}
    >
      <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 place-items-center p-3">
        {POSITIONS.map((pos) => {
          const selected = pos === value;
          return (
            <button
              key={pos}
              type="button"
              aria-label={pos.replace("-", " ")}
              onClick={() => onChange(pos)}
              className={`w-3 h-3 rounded-full transition-all cursor-pointer ${
                selected
                  ? "bg-accent scale-125"
                  : "border-2 border-ink-muted/30 hover:border-ink-muted/60"
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const [models, setModels] = useState<WhisperModelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [buildToolsStatus, setBuildToolsStatus] =
    useState<WhisperBuildToolsStatus | null>(null);
  const [rebuildState, setRebuildState] = useState<RebuildState>("idle");
  const [rebuildLog, setRebuildLog] = useState<WhisperRebuildProgress[]>([]);
  const [rebuildMessage, setRebuildMessage] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>({
    quickCapture: { enabled: true, position: "bottom-right", shortcut: "CommandOrControl+Shift+N" },
  });
  const [recordingShortcut, setRecordingShortcut] = useState(false);

  const updateSettings = useCallback((next: AppSettings) => {
    setSettings(next);
    window.electron?.saveSettings(next);
  }, []);

  // Capture shortcut at the window level to prevent other handlers from firing
  useEffect(() => {
    if (!recordingShortcut) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      const shortcut = keyEventToShortcut(e);
      if (shortcut) {
        setRecordingShortcut(false);
        updateSettings({
          ...settings,
          quickCapture: { ...settings.quickCapture, shortcut },
        });
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [recordingShortcut, settings, updateSettings]);

  useEffect(() => {
    const electron = window.electron as WhisperElectronAPI | undefined;
    if (!electron) return;
    electron.loadSettings().then(setSettings);
    electron.getWhisperModels().then((m) => {
      setModels(m);
      setLoading(false);
    });
    electron.checkWhisperBuildTools().then(setBuildToolsStatus).catch(() => {
      setBuildToolsStatus(null);
    });
  }, []);

  useEffect(() => {
    if (!window.electron) return;
    return window.electron.onWhisperDownloadProgress((p) => {
      setProgress(p);
    });
  }, []);

  useEffect(() => {
    const electron = window.electron as WhisperElectronAPI | undefined;
    if (!electron?.onWhisperRebuildProgress) return;
    return electron.onWhisperRebuildProgress((p) => {
      setRebuildLog((current) => [...current, p].slice(-6));
    });
  }, []);

  // Close on Escape (only when not downloading or rebuilding)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (
        e.key === "Escape" &&
        !downloading &&
        rebuildState !== "rebuilding" &&
        !recordingShortcut
      ) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, downloading, rebuildState, recordingShortcut]);

  const handleDownload = useCallback(async (filename: string) => {
    if (!window.electron) return;
    setError(null);
    setDownloading(filename);
    setProgress({ percent: 0, downloadedMB: 0, totalMB: 0 });

    try {
      await window.electron.downloadWhisperModel(filename);
      const updated = await window.electron.getWhisperModels();
      setModels(updated);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDownloading(null);
      setProgress(null);
    }
  }, []);

  const handleDelete = useCallback(
    async (filename: string) => {
      if (confirmingDelete !== filename) {
        setConfirmingDelete(filename);
        return;
      }

      if (!window.electron) return;
      setConfirmingDelete(null);
      const updated = await window.electron.deleteWhisperModel(filename);
      setModels(updated);
    },
    [confirmingDelete]
  );

  const handleSelect = useCallback(async (filename: string) => {
    if (!window.electron) return;
    const updated = await window.electron.setWhisperModel(filename);
    setModels(updated);
  }, []);

  const handleRebuildWhisper = useCallback(async () => {
    const electron = window.electron as WhisperElectronAPI | undefined;
    if (!electron) return;

    setError(null);
    setRebuildMessage(null);
    setRebuildLog([]);
    setRebuildState("checking");

    try {
      const tools = await electron.checkWhisperBuildTools();
      setBuildToolsStatus(tools);
      if (!tools.supported || !tools.ok) {
        setRebuildState("idle");
        setRebuildMessage(getWhisperBuildToolsMessage(tools));
        return;
      }

      setRebuildState("rebuilding");
      const result = await electron.rebuildWhisper();
      if (result.success) {
        setRebuildState("success");
        setRebuildMessage("Whisper rebuilt successfully.");
      } else {
        setRebuildState("idle");
        setRebuildMessage(result.error ?? "Whisper rebuild failed.");
      }
    } catch (e) {
      setRebuildState("idle");
      setRebuildMessage((e as Error).message);
    }
  }, []);

  // Clear delete confirmation when clicking elsewhere
  const clearConfirm = useCallback(() => setConfirmingDelete(null), []);

  const canClose = !downloading && rebuildState !== "rebuilding";
  const showWhisperRebuild =
    typeof window !== "undefined" &&
    !!window.electron &&
    buildToolsStatus?.supported === true;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={canClose ? onClose : clearConfirm}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        onClick={(e) => {
          e.stopPropagation();
          clearConfirm();
        }}
        className="w-full max-w-md bg-surface border border-edge rounded-2xl shadow-xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-edge-light">
          <h2 className="text-lg font-hand text-ink">Settings</h2>
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
        <div className="px-5 py-4 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Quick Note section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-ink-muted uppercase tracking-wide">
                Quick Note
              </p>
              <button
                type="button"
                role="switch"
                aria-checked={settings.quickCapture.enabled}
                onClick={() =>
                  updateSettings({
                    ...settings,
                    quickCapture: {
                      ...settings.quickCapture,
                      enabled: !settings.quickCapture.enabled,
                    },
                  })
                }
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
                  settings.quickCapture.enabled ? "bg-accent" : "bg-edge"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform mt-0.5 ${
                    settings.quickCapture.enabled ? "translate-x-[18px]" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>

            <PositionPicker
              value={settings.quickCapture.position}
              disabled={!settings.quickCapture.enabled}
              onChange={(position) =>
                updateSettings({
                  ...settings,
                  quickCapture: { ...settings.quickCapture, position },
                })
              }
            />

            <div className={`flex items-center justify-between ${!settings.quickCapture.enabled ? "opacity-40 pointer-events-none" : ""}`}>
              <p className="text-xs text-ink-muted">Shortcut</p>
              <button
                type="button"
                onClick={() => setRecordingShortcut(!recordingShortcut)}
                className={`px-3 py-1.5 text-xs rounded-md border transition-colors cursor-pointer ${
                  recordingShortcut
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-edge bg-surface-hover/50 text-ink-muted hover:text-ink"
                }`}
              >
                {recordingShortcut
                  ? "Press shortcut\u2026"
                  : formatShortcut(settings.quickCapture.shortcut)}
              </button>
            </div>
          </div>

          <hr className="border-edge-light" />

          <p className="text-xs font-medium text-ink-muted uppercase tracking-wide">
            Transcription models
          </p>

          {loading && (
            <div className="flex items-center justify-center py-8">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                className="w-5 h-5 border-2 border-edge border-t-accent rounded-full"
              />
            </div>
          )}

          {!loading && (
            <div className="space-y-2">
              {models.map((model) => {
                const isDownloading = downloading === model.filename;
                const isConfirming = confirmingDelete === model.filename;

                return (
                  <div
                    key={model.filename}
                    className={`flex items-start gap-3 px-3 py-3 rounded-xl border transition-colors ${
                      model.selected
                        ? "border-accent bg-accent/5"
                        : "border-edge"
                    }`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="radio"
                      name="whisper-model-select"
                      checked={model.selected}
                      disabled={!model.installed || !!downloading}
                      onChange={() => handleSelect(model.filename)}
                      className="mt-1 accent-accent cursor-pointer disabled:cursor-not-allowed"
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

                      {/* Download progress */}
                      {isDownloading && progress && (
                        <div className="mt-2 space-y-1">
                          <div className="h-1.5 rounded-full bg-edge overflow-hidden">
                            <motion.div
                              className="h-full bg-accent rounded-full"
                              initial={{ width: "0%" }}
                              animate={{ width: `${progress.percent}%` }}
                              transition={{ duration: 0.3, ease: "easeOut" }}
                            />
                          </div>
                          <p className="text-[11px] text-ink-muted">
                            {progress.downloadedMB} / {progress.totalMB} MB (
                            {progress.percent}%)
                          </p>
                        </div>
                      )}

                      {/* Action button */}
                      {!isDownloading && (
                        <div className="mt-2">
                          {model.installed ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(model.filename);
                              }}
                              disabled={!!downloading}
                              className={`text-xs transition-colors cursor-pointer disabled:cursor-not-allowed ${
                                isConfirming
                                  ? "text-danger font-medium"
                                  : "text-ink-muted hover:text-danger"
                              }`}
                            >
                              {isConfirming ? "Are you sure?" : "Remove"}
                            </button>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownload(model.filename);
                              }}
                              disabled={!!downloading}
                              className="text-xs text-accent hover:text-accent-hover transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              Download
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {error && <p className="text-xs text-danger">{error}</p>}

          {showWhisperRebuild && (
            <>
              <hr className="border-edge-light" />

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-ink-muted uppercase tracking-wide">
                      Whisper binary
                    </p>
                    <p className="text-xs text-ink-muted mt-1">
                      Rebuild whisper.cpp locally with Metal, Core ML, and Accelerate.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRebuildWhisper}
                    disabled={
                      !!downloading ||
                      rebuildState === "checking" ||
                      rebuildState === "rebuilding"
                    }
                    className="shrink-0 px-3 py-1.5 text-xs rounded-md border border-edge bg-surface-hover/50 text-ink-muted hover:text-ink transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {rebuildState === "checking"
                      ? "Checking..."
                      : rebuildState === "rebuilding"
                        ? "Rebuilding..."
                        : "Rebuild Whisper"}
                  </button>
                </div>

                {rebuildState === "rebuilding" && (
                  <div className="space-y-2">
                    <div className="h-1.5 rounded-full bg-edge overflow-hidden">
                      <motion.div
                        className="h-full w-1/3 bg-accent rounded-full"
                        animate={{ x: ["-100%", "300%"] }}
                        transition={{
                          repeat: Infinity,
                          duration: 1.4,
                          ease: "easeInOut",
                        }}
                      />
                    </div>
                    <div className="max-h-28 overflow-hidden rounded-lg border border-edge bg-surface-hover/40 px-2.5 py-2">
                      {rebuildLog.length === 0 ? (
                        <p className="text-[11px] text-ink-muted">
                          Starting build...
                        </p>
                      ) : (
                        <div className="space-y-1">
                          {rebuildLog.map((entry, index) => (
                            <p
                              key={`${entry.line}-${index}`}
                              className={`text-[11px] leading-snug truncate ${
                                entry.stream === "stderr"
                                  ? "text-danger"
                                  : "text-ink-muted"
                              }`}
                            >
                              {entry.line}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {rebuildMessage && (
                  <p
                    className={`text-xs ${
                      rebuildState === "success" ? "text-accent" : "text-danger"
                    }`}
                  >
                    {rebuildMessage}
                  </p>
                )}
              </div>
            </>
          )}

          {/* Privacy note */}
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
        </div>
      </motion.div>
    </motion.div>
  );
}

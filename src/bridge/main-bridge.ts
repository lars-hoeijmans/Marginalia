/**
 * Preload bridge for the main window.
 * Transpiled by Electrobun's build system and injected via the preload option.
 * Exposes `window.electron` with the same API shape the existing frontend expects,
 * backed by Electrobun's Electroview RPC.
 */
import { Electroview } from "electrobun/view";
import type { MainWindowRPC } from "../bun/rpc-schema";

type EventCallback = (...args: unknown[]) => void;
const listeners = new Map<string, Set<EventCallback>>();

function addListener(event: string, cb: EventCallback): () => void {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event)!.add(cb);
  return () => {
    listeners.get(event)?.delete(cb);
  };
}

function emit(event: string, ...args: unknown[]) {
  listeners.get(event)?.forEach((cb) => cb(...args));
}

const rpc = Electroview.defineRPC<MainWindowRPC>({
  maxRequestTime: 120000,
  handlers: {
    requests: {},
    messages: {
      exportNotes: () => emit("exportNotes"),
      importNotes: (data) => emit("importNotes", data.notes),
      openAppleNotesModal: () => emit("openAppleNotesModal"),
      openSettings: () => emit("openSettings"),
      openOnboarding: () => emit("openOnboarding"),
      openWhisperSetup: () => emit("openWhisperSetup"),
      pickAndTranscribeAudio: () => emit("pickAndTranscribeAudio"),
      notesChangedExternally: () => emit("notesChangedExternally"),
      whisperDownloadProgress: (progress) =>
        emit("whisperDownloadProgress", progress),
      transcriptionProgress: (data) =>
        emit("transcriptionProgress", data),
    },
  },
});

const electroview = new Electroview({ rpc });

(window as Record<string, unknown>).electron = {
  loadNotes: () => electroview.rpc.request.loadNotes(),

  saveNotes: (notes: unknown[]) =>
    electroview.rpc.request.saveNotes({ notes } as never),

  exportNotes: () => electroview.rpc.request.exportNotes(),

  onExportNotes: (callback: () => void) =>
    addListener("exportNotes", callback),

  importTextFiles: () => electroview.rpc.request.importTextFiles(),

  listAppleNotes: () => electroview.rpc.request.listAppleNotes(),

  getAppleNoteBodies: (ids: string[]) =>
    electroview.rpc.request.getAppleNoteBodies({ ids }),

  onImportNotes: (
    callback: (notes: Array<{ title: string; body: string }>) => void
  ) => addListener("importNotes", callback),

  onOpenAppleNotesModal: (callback: () => void) =>
    addListener("openAppleNotesModal", callback),

  whisperModelStatus: () => electroview.rpc.request.whisperModelStatus(),

  downloadWhisperModel: (filename: string) =>
    electroview.rpc.request.downloadWhisperModel({ filename }),

  getWhisperModels: () => electroview.rpc.request.getWhisperModels(),

  deleteWhisperModel: (filename: string) =>
    electroview.rpc.request.deleteWhisperModel({ filename }),

  setWhisperModel: (filename: string) =>
    electroview.rpc.request.setWhisperModel({ filename }),

  onOpenOnboarding: (callback: () => void) =>
    addListener("openOnboarding", callback),

  onOpenSettings: (callback: () => void) =>
    addListener("openSettings", callback),

  pickAudioFile: () => electroview.rpc.request.pickAudioFile(),

  transcribeAudio: (filePath: string) =>
    electroview.rpc.request.transcribeAudio({ filePath }),

  onWhisperDownloadProgress: (
    callback: (progress: {
      percent: number;
      downloadedMB: number;
      totalMB: number;
    }) => void
  ) => addListener("whisperDownloadProgress", callback),

  onOpenWhisperSetup: (callback: () => void) =>
    addListener("openWhisperSetup", callback),

  onPickAndTranscribeAudio: (callback: () => void) =>
    addListener("pickAndTranscribeAudio", callback),

  quickCaptureSave: () =>
    Promise.reject(new Error("Not available in main window")),

  quickCaptureDismiss: () =>
    Promise.reject(new Error("Not available in main window")),

  onQuickCaptureReset: () => () => {},

  onNotesChangedExternally: (callback: () => void) =>
    addListener("notesChangedExternally", callback),

  loadSettings: () => electroview.rpc.request.loadSettings(),

  saveSettings: (settings: Record<string, unknown>) =>
    electroview.rpc.request.saveSettings({ settings } as never),
};

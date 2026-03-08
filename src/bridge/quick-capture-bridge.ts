/**
 * Preload bridge for the quick capture window.
 * Separate from main-bridge because it uses a different, smaller RPC schema.
 */
import { Electroview } from "electrobun/view";
import type { QuickCaptureRPC } from "../bun/rpc-schema";

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

const rpc = Electroview.defineRPC<QuickCaptureRPC>({
  handlers: {
    requests: {},
    messages: {
      quickCaptureReset: () => emit("quickCaptureReset"),
    },
  },
});

const electroview = new Electroview({ rpc });

// Flag so the React app knows this is the quick capture window
(window as Record<string, unknown>).__QUICK_CAPTURE__ = true;

(window as Record<string, unknown>).electron = {
  quickCaptureSave: (payload: { title: string; body: string }) =>
    electroview.rpc.request.quickCaptureSave(payload),

  quickCaptureDismiss: () =>
    electroview.rpc.request.quickCaptureDismiss(),

  onQuickCaptureReset: (callback: () => void) =>
    addListener("quickCaptureReset", callback),

  // Stubs for APIs not used in quick capture but present on the interface
  loadNotes: () => Promise.resolve(null),
  saveNotes: () => Promise.resolve(),
  exportNotes: () => Promise.resolve(false),
  onExportNotes: () => () => {},
  importTextFiles: () => Promise.resolve([]),
  listAppleNotes: () => Promise.resolve([]),
  getAppleNoteBodies: () => Promise.resolve([]),
  onImportNotes: () => () => {},
  onOpenAppleNotesModal: () => () => {},
  whisperModelStatus: () => Promise.resolve(null),
  downloadWhisperModel: () => Promise.resolve(),
  getWhisperModels: () => Promise.resolve([]),
  deleteWhisperModel: () => Promise.resolve([]),
  setWhisperModel: () => Promise.resolve([]),
  onOpenOnboarding: () => () => {},
  onOpenSettings: () => () => {},
  pickAudioFile: () => Promise.resolve(null),
  transcribeAudio: () => Promise.reject(new Error("Not available")),
  onWhisperDownloadProgress: () => () => {},
  onOpenWhisperSetup: () => () => {},
  onPickAndTranscribeAudio: () => () => {},
  onNotesChangedExternally: () => () => {},
  loadSettings: () =>
    Promise.resolve({
      quickCapture: { enabled: true, position: "bottom-right" as const },
    }),
  saveSettings: () => Promise.resolve(),
};

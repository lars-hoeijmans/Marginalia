import type { Note } from "./types";

type QuickCapturePosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "center-left"
  | "center"
  | "center-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

interface AppSettings {
  quickCapture: {
    enabled: boolean;
    position: QuickCapturePosition;
  };
}

interface AppleNoteEntry {
  id: string;
  name: string;
  folder: string;
  modifiedDate: string;
  preview: string;
}

interface WhisperDownloadProgress {
  percent: number;
  downloadedMB: number;
  totalMB: number;
}

interface WhisperModelInfo {
  filename: string;
  label: string;
  size: string;
  description: string;
  recommended: boolean;
  installed: boolean;
  selected: boolean;
}

interface ElectronAPI {
  loadNotes: () => Promise<Note[] | null>;
  saveNotes: (notes: Note[]) => Promise<void>;
  exportNotes: () => Promise<boolean>;
  onExportNotes: (callback: () => void) => () => void;
  importTextFiles: () => Promise<Array<{ title: string; body: string }>>;
  listAppleNotes: () => Promise<AppleNoteEntry[]>;
  getAppleNoteBodies: (
    ids: string[]
  ) => Promise<Array<{ id: string; title: string; body: string }>>;
  onImportNotes: (
    callback: (notes: Array<{ title: string; body: string }>) => void
  ) => () => void;
  onOpenAppleNotesModal: (callback: () => void) => () => void;
  whisperModelStatus: () => Promise<string | null>;
  downloadWhisperModel: (filename: string) => Promise<void>;
  getWhisperModels: () => Promise<WhisperModelInfo[]>;
  deleteWhisperModel: (filename: string) => Promise<WhisperModelInfo[]>;
  setWhisperModel: (filename: string) => Promise<WhisperModelInfo[]>;
  onOpenOnboarding: (callback: () => void) => () => void;
  onOpenSettings: (callback: () => void) => () => void;
  pickAudioFile: () => Promise<string | null>;
  transcribeAudio: (
    filePath: string
  ) => Promise<{ title: string; body: string }>;
  onWhisperDownloadProgress: (
    callback: (progress: WhisperDownloadProgress) => void
  ) => () => void;
  onOpenWhisperSetup: (callback: () => void) => () => void;
  onPickAndTranscribeAudio: (callback: () => void) => () => void;
  quickCaptureSave: (payload: { title: string; body: string }) => Promise<void>;
  quickCaptureDismiss: () => Promise<void>;
  onQuickCaptureReset: (callback: () => void) => () => void;
  onNotesChangedExternally: (callback: () => void) => () => void;
  loadSettings: () => Promise<AppSettings>;
  saveSettings: (settings: AppSettings) => Promise<void>;
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}

export type {
  AppSettings,
  AppleNoteEntry,
  ElectronAPI,
  QuickCapturePosition,
  WhisperDownloadProgress,
  WhisperModelInfo,
};

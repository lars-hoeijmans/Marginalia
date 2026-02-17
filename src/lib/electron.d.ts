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

interface ElectronAPI {
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
  pickAudioFile: () => Promise<string | null>;
  transcribeAudio: (
    filePath: string
  ) => Promise<{ title: string; body: string }>;
  onWhisperDownloadProgress: (
    callback: (progress: WhisperDownloadProgress) => void
  ) => () => void;
  onOpenWhisperSetup: (callback: () => void) => () => void;
  onPickAndTranscribeAudio: (callback: () => void) => () => void;
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}

export type { AppleNoteEntry, ElectronAPI, WhisperDownloadProgress };

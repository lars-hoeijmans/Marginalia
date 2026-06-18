import type { RPCSchema } from "electrobun/bun";

export interface Note {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
}

export type QuickCapturePosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "center-left"
  | "center"
  | "center-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export interface AppSettings {
  quickCapture: {
    enabled: boolean;
    position: QuickCapturePosition;
    shortcut: string;
  };
}

export interface AppleNoteEntry {
  id: string;
  name: string;
  folder: string;
  modifiedDate: string;
  preview: string;
}

export interface WhisperDownloadProgress {
  percent: number;
  downloadedMB: number;
  totalMB: number;
}

export interface WhisperBuildToolsStatus {
  supported: boolean;
  ok: boolean;
  missing: string[];
}

export interface WhisperRebuildProgress {
  line: string;
  stream: "stdout" | "stderr";
}

export interface WhisperRebuildResult {
  success: boolean;
  error?: string;
}

export interface WhisperModelInfo {
  filename: string;
  label: string;
  size: string;
  description: string;
  recommended: boolean;
  installed: boolean;
  selected: boolean;
}

// RPC type shared between bun main process and webview
export type MainWindowRPC = {
  bun: RPCSchema<{
    requests: {
      loadNotes: { params: void; response: Note[] | null };
      saveNotes: { params: { notes: Note[] }; response: void };
      exportNotes: { params: void; response: boolean };
      importTextFiles: {
        params: void;
        response: Array<{ title: string; body: string }>;
      };
      listAppleNotes: { params: void; response: AppleNoteEntry[] };
      getAppleNoteBodies: {
        params: { ids: string[] };
        response: Array<{ id: string; title: string; body: string }>;
      };
      loadSettings: { params: void; response: AppSettings };
      saveSettings: { params: { settings: AppSettings }; response: void };
      whisperModelStatus: { params: void; response: string | null };
      downloadWhisperModel: { params: { filename: string }; response: void };
      checkWhisperBuildTools: {
        params: void;
        response: WhisperBuildToolsStatus;
      };
      rebuildWhisper: { params: void; response: WhisperRebuildResult };
      getWhisperModels: { params: void; response: WhisperModelInfo[] };
      deleteWhisperModel: {
        params: { filename: string };
        response: WhisperModelInfo[];
      };
      setWhisperModel: {
        params: { filename: string };
        response: WhisperModelInfo[];
      };
      pickAudioFile: { params: void; response: string | null };
      transcribeAudio: {
        params: { filePath: string };
        response: { title: string; body: string };
      };
    };
    messages: {};
  }>;
  webview: RPCSchema<{
    requests: {};
    messages: {
      exportNotes: void;
      importNotes: { notes: Array<{ title: string; body: string }> };
      openAppleNotesModal: void;
      openSettings: void;
      openOnboarding: void;
      openWhisperSetup: void;
      pickAndTranscribeAudio: void;
      notesChangedExternally: void;
      whisperDownloadProgress: WhisperDownloadProgress;
      whisperRebuildProgress: WhisperRebuildProgress;
      transcriptionProgress: { active: boolean };
    };
  }>;
};

// Quick Capture window has its own smaller RPC surface
export type QuickCaptureRPC = {
  bun: RPCSchema<{
    requests: {
      quickCaptureSave: {
        params: { title: string; body: string };
        response: void;
      };
      quickCaptureDismiss: { params: void; response: void };
    };
    messages: {};
  }>;
  webview: RPCSchema<{
    requests: {};
    messages: {
      quickCaptureReset: void;
    };
  }>;
};

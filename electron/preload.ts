import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electron", {
  listAppleNotes: () => ipcRenderer.invoke("list-apple-notes"),

  getAppleNoteBodies: (ids: string[]) =>
    ipcRenderer.invoke("get-apple-note-bodies", ids),

  onImportNotes: (
    callback: (notes: Array<{ title: string; body: string }>) => void
  ) => {
    const handler = (_event: Electron.IpcRendererEvent, notes: Array<{ title: string; body: string }>) =>
      callback(notes);
    ipcRenderer.on("import-notes", handler);
    return () => {
      ipcRenderer.removeListener("import-notes", handler);
    };
  },

  onOpenAppleNotesModal: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("open-apple-notes-modal", handler);
    return () => {
      ipcRenderer.removeListener("open-apple-notes-modal", handler);
    };
  },

  whisperModelStatus: () => ipcRenderer.invoke("whisper-model-status"),

  downloadWhisperModel: (filename: string) =>
    ipcRenderer.invoke("download-whisper-model", filename),

  pickAudioFile: () => ipcRenderer.invoke("pick-audio-file"),

  transcribeAudio: (filePath: string) =>
    ipcRenderer.invoke("transcribe-audio", filePath),

  onWhisperDownloadProgress: (
    callback: (progress: {
      percent: number;
      downloadedMB: number;
      totalMB: number;
    }) => void
  ) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      progress: { percent: number; downloadedMB: number; totalMB: number }
    ) => callback(progress);
    ipcRenderer.on("whisper-download-progress", handler);
    return () => {
      ipcRenderer.removeListener("whisper-download-progress", handler);
    };
  },

  onOpenWhisperSetup: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("open-whisper-setup", handler);
    return () => {
      ipcRenderer.removeListener("open-whisper-setup", handler);
    };
  },

  onPickAndTranscribeAudio: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("pick-and-transcribe-audio", handler);
    return () => {
      ipcRenderer.removeListener("pick-and-transcribe-audio", handler);
    };
  },
});

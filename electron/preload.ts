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
});

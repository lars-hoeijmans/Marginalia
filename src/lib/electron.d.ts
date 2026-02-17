interface AppleNoteEntry {
  id: string;
  name: string;
  folder: string;
  modifiedDate: string;
  preview: string;
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
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}

export type { AppleNoteEntry, ElectronAPI };

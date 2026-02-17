import {
  app,
  BrowserWindow,
  Menu,
  Tray,
  dialog,
  ipcMain,
  globalShortcut,
  screen,
  nativeImage,
} from "electron";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import serve from "electron-serve";
import { parseFile } from "./import-parsers";
import {
  getInstalledModel,
  downloadModel,
  transcribe,
  getModelsWithStatus,
  deleteModel,
  setSelectedModel,
} from "./whisper";

function stripHtmlToPlain(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(div|p|li)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const isProd = app.isPackaged;

if (isProd) {
  serve({ directory: path.join(__dirname, "../out") });
}

let mainWindow: BrowserWindow | null = null;
let quickCaptureWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

function createTrayIcon(): Electron.NativeImage {
  const iconPath = isProd
    ? path.join(process.resourcesPath, "trayIconTemplate.png")
    : path.join(__dirname, "../resources/trayIconTemplate.png");
  const icon = nativeImage.createFromPath(iconPath);
  icon.setTemplateImage(true);
  return icon;
}

function showMainWindow() {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  } else {
    createWindow();
  }
  app.dock?.show();
}

function createTray() {
  tray = new Tray(createTrayIcon());
  tray.setToolTip("Marginalia");

  const contextMenu = Menu.buildFromTemplate([
    { label: "Show Marginalia", click: showMainWindow },
    { label: "Quick Note", click: toggleQuickCapture },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() },
  ]);
  tray.setContextMenu(contextMenu);
}

function createWindow() {
  const win = new BrowserWindow({
    title: "Marginalia",
    width: 1200,
    height: 800,
    show: false,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#FAF7F2",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow = win;

  win.once("ready-to-show", () => {
    win.show();
  });

  win.on("closed", () => {
    mainWindow = null;
    app.dock?.hide();
  });

  if (isProd) {
    (win as BrowserWindow & { loadURL(url: string): Promise<void> }).loadURL("app://-");
  } else {
    win.loadURL("http://localhost:3000");
    win.webContents.openDevTools();
  }
}

function handleOpenSettings() {
  if (!mainWindow) return;
  mainWindow.webContents.send("open-settings");
}

function getAppUrl(queryString = "") {
  if (isProd) {
    return `app://-${queryString}`;
  }
  return `http://localhost:3000${queryString}`;
}

function createQuickCaptureWindow() {
  const win = new BrowserWindow({
    width: 440,
    height: 220,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    vibrancy: "popover",
    visualEffectState: "active",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  win.loadURL(getAppUrl("?quick-capture=1"));

  win.on("blur", () => {
    if (win.isVisible()) {
      win.hide();
    }
  });

  win.on("close", (e) => {
    if (!isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });

  quickCaptureWindow = win;
}

function getPositionCoords(
  position: string,
  area: { x: number; y: number; width: number; height: number },
  winW: number,
  winH: number
): { x: number; y: number } {
  const { x, y, width: w, height: h } = area;
  const margin = 32;

  const colMap: Record<string, number> = {
    left: x + margin,
    center: x + (w - winW) / 2,
    right: x + w - winW - margin,
  };
  const rowMap: Record<string, number> = {
    top: y + margin,
    center: y + (h - winH) / 2,
    bottom: y + h - winH - margin,
  };

  const parts = position.split("-");
  let row: string;
  let col: string;

  if (parts.length === 1) {
    // "center"
    row = "center";
    col = "center";
  } else {
    row = parts[0];
    col = parts[1];
  }

  return {
    x: Math.round(colMap[col] ?? colMap.center),
    y: Math.round(rowMap[row] ?? rowMap.center),
  };
}

function toggleQuickCapture() {
  if (!quickCaptureWindow) return;

  if (quickCaptureWindow.isVisible()) {
    quickCaptureWindow.hide();
    return;
  }

  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  const [winWidth, winHeight] = quickCaptureWindow.getSize();
  const pos = getPositionCoords(
    currentSettings.quickCapture.position,
    display.workArea,
    winWidth,
    winHeight
  );
  quickCaptureWindow.setPosition(pos.x, pos.y);

  quickCaptureWindow.show();
  quickCaptureWindow.webContents.send("quick-capture-reset");
}

function buildMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: "about" },
        { type: "separator" },
        {
          label: "Settings\u2026",
          accelerator: "CmdOrCtrl+,",
          click: handleOpenSettings,
        },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "File",
      submenu: [
        {
          label: "Quick Capture",
          accelerator: "CmdOrCtrl+Shift+N",
          click: toggleQuickCapture,
        },
        { type: "separator" },
        {
          label: "Import from text files",
          accelerator: "CmdOrCtrl+Shift+I",
          click: handleImportTextFiles,
        },
        {
          label: "Import from Apple Notes",
          click: handleOpenAppleNotesModal,
        },
        {
          label: "Import from audio",
          click: handleImportFromAudio,
        },
        { type: "separator" },
        {
          label: "Export all notes\u2026",
          click: () => {
            if (!mainWindow) return;
            mainWindow.webContents.send("export-notes");
          },
        },
        { type: "separator" },
        { role: "close" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      role: "help",
      submenu: [
        {
          label: "Welcome to Marginalia",
          click: () => {
            if (!mainWindow) return;
            mainWindow.webContents.send("open-onboarding");
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

async function handleImportTextFiles() {
  if (!mainWindow) return;

  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Import notes",
    filters: [{ name: "Text files", extensions: ["txt", "md"] }],
    properties: ["openFile", "multiSelections"],
  });

  if (result.canceled || result.filePaths.length === 0) return;

  const notes: Array<{ title: string; body: string }> = [];

  for (const filePath of result.filePaths) {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const filename = path.basename(filePath);
      notes.push(parseFile(filename, content));
    } catch {
      // Skip files that can't be read
    }
  }

  if (notes.length > 0) {
    mainWindow.webContents.send("import-notes", notes);
  }
}

function handleOpenAppleNotesModal() {
  if (!mainWindow) return;
  mainWindow.webContents.send("open-apple-notes-modal");
}

function handleImportFromAudio() {
  if (!mainWindow) return;
  const model = getInstalledModel();
  if (model) {
    mainWindow.webContents.send("pick-and-transcribe-audio");
  } else {
    mainWindow.webContents.send("open-whisper-setup");
  }
}

// Notes storage IPC handlers

const notesPath = path.join(app.getPath("userData"), "notes.json");
const settingsPath = path.join(app.getPath("userData"), "settings.json");

interface AppSettings {
  quickCapture: {
    enabled: boolean;
    position: string;
  };
}

const defaultSettings: AppSettings = {
  quickCapture: { enabled: true, position: "bottom-right" },
};

function loadSettings(): AppSettings {
  try {
    const data = fs.readFileSync(settingsPath, "utf-8");
    const parsed = JSON.parse(data);
    return {
      quickCapture: {
        enabled: parsed?.quickCapture?.enabled ?? defaultSettings.quickCapture.enabled,
        position: parsed?.quickCapture?.position ?? defaultSettings.quickCapture.position,
      },
    };
  } catch {
    return structuredClone(defaultSettings);
  }
}

let currentSettings = loadSettings();

ipcMain.handle("load-notes", async () => {
  try {
    const data = await fs.promises.readFile(notesPath, "utf-8");
    return JSON.parse(data);
  } catch {
    return null;
  }
});

ipcMain.handle("save-notes", async (_event, notes: unknown[]) => {
  const tmp = notesPath + ".tmp";
  await fs.promises.writeFile(tmp, JSON.stringify(notes, null, 2), "utf-8");
  await fs.promises.rename(tmp, notesPath);
});

ipcMain.handle("export-notes", async () => {
  if (!mainWindow) return false;

  const defaultDir = path.join(app.getPath("documents"), "Marginalia");

  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Export all notes",
    defaultPath: defaultDir,
    properties: ["openDirectory", "createDirectory"],
  });

  if (result.canceled || result.filePaths.length === 0) return false;

  try {
    const data = await fs.promises.readFile(notesPath, "utf-8");
    const notes: Array<{ title: string; body: string }> = JSON.parse(data);
    const dir = result.filePaths[0];

    const usedNames = new Set<string>();
    for (const note of notes) {
      let base = (note.title || "Untitled")
        .replace(/[/\\:*?"<>|]/g, "-")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 100);

      let name = base;
      let i = 2;
      while (usedNames.has(name.toLowerCase())) {
        name = `${base} ${i++}`;
      }
      usedNames.add(name.toLowerCase());

      const body = stripHtmlToPlain(note.body);
      const content = `# ${note.title || "Untitled"}\n\n${body}\n`;
      await fs.promises.writeFile(path.join(dir, `${name}.md`), content, "utf-8");
    }

    return true;
  } catch {
    return false;
  }
});

// Quick Capture IPC handlers

ipcMain.handle(
  "quick-capture-save",
  async (_event, payload: { title: string; body: string }) => {
    const note = {
      id: crypto.randomUUID(),
      title: payload.title,
      body: payload.body,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    let notes: unknown[] = [];
    try {
      const data = await fs.promises.readFile(notesPath, "utf-8");
      notes = JSON.parse(data);
    } catch {
      // No existing file — start fresh
    }

    notes.unshift(note);

    const tmp = notesPath + ".tmp";
    await fs.promises.writeFile(tmp, JSON.stringify(notes, null, 2), "utf-8");
    await fs.promises.rename(tmp, notesPath);

    // Notify main window to reload
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("notes-changed-externally");
    }

    // Hide the popup
    if (quickCaptureWindow) {
      quickCaptureWindow.hide();
    }
  }
);

ipcMain.handle("quick-capture-dismiss", () => {
  if (quickCaptureWindow) {
    quickCaptureWindow.hide();
  }
});

// Settings IPC handlers

ipcMain.handle("load-settings", () => {
  return currentSettings;
});

ipcMain.handle("save-settings", async (_event, settings: AppSettings) => {
  currentSettings = settings;
  const tmp = settingsPath + ".tmp";
  await fs.promises.writeFile(tmp, JSON.stringify(settings, null, 2), "utf-8");
  await fs.promises.rename(tmp, settingsPath);

  // Re-register or unregister the global shortcut based on enabled state
  globalShortcut.unregister("CmdOrCtrl+Shift+N");
  if (settings.quickCapture.enabled) {
    globalShortcut.register("CmdOrCtrl+Shift+N", toggleQuickCapture);
  }
});

// Import text files IPC handler

ipcMain.handle("import-text-files", async () => {
  if (!mainWindow) return [];

  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Import notes",
    filters: [{ name: "Text files", extensions: ["txt", "md"] }],
    properties: ["openFile", "multiSelections"],
  });

  if (result.canceled || result.filePaths.length === 0) return [];

  const notes: Array<{ title: string; body: string }> = [];

  for (const filePath of result.filePaths) {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const filename = path.basename(filePath);
      notes.push(parseFile(filename, content));
    } catch {
      // Skip files that can't be read
    }
  }

  return notes;
});

// Whisper IPC handlers

ipcMain.handle("whisper-model-status", () => {
  return getInstalledModel();
});

ipcMain.handle("download-whisper-model", async (_event, filename: string) => {
  if (!mainWindow) throw new Error("No window available");
  await downloadModel(filename, mainWindow);
});

ipcMain.handle("get-whisper-models", () => {
  return getModelsWithStatus();
});

ipcMain.handle("delete-whisper-model", (_event, filename: string) => {
  return deleteModel(filename);
});

ipcMain.handle("set-whisper-model", (_event, filename: string) => {
  return setSelectedModel(filename);
});

ipcMain.handle("pick-audio-file", async () => {
  if (!mainWindow) return null;

  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Import audio",
    filters: [
      {
        name: "Audio files",
        extensions: ["mp3", "m4a", "wav", "ogg", "webm", "flac"],
      },
    ],
    properties: ["openFile"],
  });

  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle("transcribe-audio", async (_event, filePath: string) => {
  if (!mainWindow) throw new Error("No window available");
  return transcribe(filePath, mainWindow);
});

// Apple Notes IPC handlers

function runJxa(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "osascript",
      ["-l", "JavaScript", "-e", script],
      { maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message));
        } else {
          resolve(stdout.trim());
        }
      }
    );
  });
}

ipcMain.handle("list-apple-notes", async () => {
  const script = `
    const Notes = Application("Notes");
    const allNotes = Notes.notes();
    const results = [];
    const limit = Math.min(allNotes.length, 500);
    for (let i = 0; i < limit; i++) {
      const n = allNotes[i];
      const body = n.plaintext();
      results.push({
        id: n.id(),
        name: n.name(),
        folder: n.container().name(),
        modifiedDate: n.modificationDate().toISOString(),
        preview: body.substring(0, 120)
      });
    }
    JSON.stringify(results);
  `;

  try {
    const output = await runJxa(script);
    return JSON.parse(output);
  } catch (e) {
    throw new Error(
      `Failed to access Apple Notes. Make sure Marginalia has Automation permission. ${(e as Error).message}`
    );
  }
});

ipcMain.handle("get-apple-note-bodies", async (_event, ids: string[]) => {
  // Build a JXA script that fetches bodies for specific note IDs
  const idsJson = JSON.stringify(ids);
  const script = `
    const Notes = Application("Notes");
    const targetIds = ${idsJson};
    const results = [];
    const allNotes = Notes.notes();
    for (let i = 0; i < allNotes.length; i++) {
      const n = allNotes[i];
      const noteId = n.id();
      if (targetIds.indexOf(noteId) !== -1) {
        results.push({
          id: noteId,
          title: n.name(),
          body: n.body()
        });
        if (results.length === targetIds.length) break;
      }
    }
    JSON.stringify(results);
  `;

  try {
    const output = await runJxa(script);
    return JSON.parse(output);
  } catch (e) {
    throw new Error(`Failed to fetch note bodies. ${(e as Error).message}`);
  }
});

app.whenReady().then(() => {
  currentSettings = loadSettings();
  buildMenu();
  createTray();
  createWindow();
  createQuickCaptureWindow();

  if (currentSettings.quickCapture.enabled) {
    globalShortcut.register("CmdOrCtrl+Shift+N", toggleQuickCapture);
  }
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (!mainWindow) {
    createWindow();
  }
});

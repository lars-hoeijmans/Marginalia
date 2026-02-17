import { app, BrowserWindow, Menu, dialog, ipcMain } from "electron";
import path from "node:path";
import fs from "node:fs";
import { execFile } from "node:child_process";
import serve from "electron-serve";
import { parseFile } from "./import-parsers";

const isProd = app.isPackaged;

if (isProd) {
  serve({ directory: path.join(__dirname, "../out") });
}

let mainWindow: BrowserWindow | null = null;

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
  });

  if (isProd) {
    (win as BrowserWindow & { loadURL(url: string): Promise<void> }).loadURL("app://-");
  } else {
    win.loadURL("http://localhost:3000");
    win.webContents.openDevTools();
  }
}

function buildMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    { role: "appMenu" },
    {
      label: "File",
      submenu: [
        {
          label: "Import notes from text",
          accelerator: "CmdOrCtrl+Shift+I",
          click: handleImportTextFiles,
        },
        {
          label: "Import from Apple Notes",
          click: handleOpenAppleNotesModal,
        },
        { type: "separator" },
        { role: "close" },
      ],
    },
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" },
    {
      role: "help",
      submenu: [{ role: "toggleDevTools" }],
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
  buildMenu();
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

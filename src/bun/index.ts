import Electrobun, {
  BrowserWindow,
  BrowserView,
  ApplicationMenu,
  Tray,
  Utils,
  Screen,
} from "electrobun/bun";
import {
  register as registerHotKey,
  unregister as unregisterHotKey,
  unregisterAll as unregisterAllHotKeys,
} from "./carbon-hotkey";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { parseFile } from "./import-parsers";
import { showInDock, hideFromDock } from "./dock";
import {
  getInstalledModel,
  downloadModel,
  transcribe,
  getModelsWithStatus,
  deleteModel,
  setSelectedModel,
  setUserDataPath,
  setWhisperBinaryPath,
} from "./whisper";
import type {
  MainWindowRPC,
  QuickCaptureRPC,
  AppSettings,
  Note,
} from "./rpc-schema";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const userData = Utils.paths.userData;
const notesPath = path.join(userData, "notes.json");
const settingsPath = path.join(userData, "settings.json");

// Ensure userData dir exists
if (!fs.existsSync(userData)) {
  fs.mkdirSync(userData, { recursive: true });
}

// Configure whisper paths
setUserDataPath(userData);

const whisperBin = path.join(import.meta.dir, "../bin/whisper-cli");
setWhisperBinaryPath(whisperBin);

const WHISPER_REBUILD_TIMEOUT_MS = 5 * 60 * 1000;
let whisperRebuildRunning = false;

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

const defaultSettings: AppSettings = {
  quickCapture: { enabled: true, position: "bottom-right", shortcut: "CommandOrControl+Shift+N" },
};

function loadSettings(): AppSettings {
  try {
    const data = fs.readFileSync(settingsPath, "utf-8");
    const parsed = JSON.parse(data);
    return {
      quickCapture: {
        enabled:
          parsed?.quickCapture?.enabled ?? defaultSettings.quickCapture.enabled,
        position:
          parsed?.quickCapture?.position ??
          defaultSettings.quickCapture.position,
        shortcut:
          parsed?.quickCapture?.shortcut ??
          defaultSettings.quickCapture.shortcut,
      },
    };
  } catch {
    return structuredClone(defaultSettings);
  }
}

let currentSettings = loadSettings();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function getAppUrl() {
  // HTML and _next/ assets both live under views://app/
  return "views://app/index.html";
}

function getWhisperSetupScriptPath(): string {
  const candidates = [
    path.join(process.cwd(), "scripts/setup-whisper.sh"),
    path.join(import.meta.dir, "../../scripts/setup-whisper.sh"),
  ];

  const scriptPath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!scriptPath) {
    throw new Error("Could not find scripts/setup-whisper.sh");
  }

  return scriptPath;
}

function commandAvailable(command: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(command, args, { timeout: 10000 }, (error) => {
      resolve(!error);
    });
  });
}

async function checkWhisperBuildTools() {
  if (process.platform !== "darwin") {
    return { supported: false, ok: false, missing: ["macOS"] };
  }

  const checks = await Promise.all([
    commandAvailable("git", ["--version"]),
    commandAvailable("cmake", ["--version"]),
    commandAvailable("xcode-select", ["-p"]),
  ]);
  const labels = ["git", "cmake", "Xcode Command Line Tools"];
  const missing = labels.filter((_, index) => !checks[index]);

  return {
    supported: true,
    ok: missing.length === 0,
    missing,
  };
}

function sendWhisperRebuildProgress(line: string, stream: "stdout" | "stderr") {
  if (!mainWindow) return;
  mainWindow.webview.rpc.send.whisperRebuildProgress({ line, stream });
}

async function rebuildWhisperBinary() {
  if (whisperRebuildRunning) {
    return { success: false, error: "Whisper rebuild is already running." };
  }

  const tools = await checkWhisperBuildTools();
  if (!tools.supported) {
    return { success: false, error: "Whisper rebuild is only available on macOS." };
  }
  if (!tools.ok) {
    return {
      success: false,
      error:
        tools.missing.includes("Xcode Command Line Tools")
          ? "Xcode Command Line Tools required. Run: xcode-select --install"
          : `Missing build tools: ${tools.missing.join(", ")}`,
    };
  }

  let scriptPath: string;
  try {
    scriptPath = getWhisperSetupScriptPath();
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }

  whisperRebuildRunning = true;
  sendWhisperRebuildProgress("Starting whisper.cpp rebuild...", "stdout");

  return new Promise<{ success: boolean; error?: string }>((resolve) => {
    let settled = false;
    let stdoutBuffer = "";
    let stderrBuffer = "";
    let lastErrorLine = "";
    const proc = spawn("bash", [scriptPath], {
      cwd: path.dirname(path.dirname(scriptPath)),
      env: process.env,
    });

    const finish = (result: { success: boolean; error?: string }) => {
      if (settled) return;
      settled = true;
      whisperRebuildRunning = false;
      resolve(result);
    };

    const flushLines = (
      chunk: Buffer,
      stream: "stdout" | "stderr",
      currentBuffer: string
    ) => {
      const parts = (currentBuffer + chunk.toString()).split(/\r?\n/);
      const nextBuffer = parts.pop() ?? "";

      for (const part of parts) {
        const line = part.trimEnd();
        if (!line) continue;
        if (stream === "stderr") lastErrorLine = line;
        sendWhisperRebuildProgress(line, stream);
      }

      return nextBuffer;
    };

    const timeout = setTimeout(() => {
      proc.kill("SIGTERM");
      finish({ success: false, error: "Whisper rebuild timed out." });
    }, WHISPER_REBUILD_TIMEOUT_MS);

    proc.stdout.on("data", (chunk: Buffer) => {
      stdoutBuffer = flushLines(chunk, "stdout", stdoutBuffer);
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      stderrBuffer = flushLines(chunk, "stderr", stderrBuffer);
    });

    proc.on("error", (error) => {
      clearTimeout(timeout);
      finish({ success: false, error: error.message });
    });

    proc.on("close", (code) => {
      clearTimeout(timeout);

      if (stdoutBuffer.trim()) {
        sendWhisperRebuildProgress(stdoutBuffer.trimEnd(), "stdout");
      }
      if (stderrBuffer.trim()) {
        lastErrorLine = stderrBuffer.trimEnd();
        sendWhisperRebuildProgress(lastErrorLine, "stderr");
      }

      if (code === 0) {
        finish({ success: true });
      } else {
        finish({
          success: false,
          error: lastErrorLine || `Whisper rebuild failed with exit code ${code}.`,
        });
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Main Window
// ---------------------------------------------------------------------------

let mainWindow: BrowserWindow | null = null;
let quickCaptureWindow: BrowserWindow | null = null;
let isQuitting = false;

// Electrobun's BrowserWindow lacks hide()/isVisible(), so we
// destroy the window to "hide" and recreate to "show".
function dismissQuickCapture() {
  if (quickCaptureWindow) {
    quickCaptureWindow.close();
    quickCaptureWindow = null;
  }
}

const mainRpc = BrowserView.defineRPC<MainWindowRPC>({
  maxRequestTime: WHISPER_REBUILD_TIMEOUT_MS + 30000,
  handlers: {
    requests: {
      loadNotes: async () => {
        try {
          const data = await fs.promises.readFile(notesPath, "utf-8");
          return JSON.parse(data);
        } catch {
          return null;
        }
      },

      saveNotes: async ({ notes }) => {
        const tmp = notesPath + ".tmp";
        await fs.promises.writeFile(
          tmp,
          JSON.stringify(notes, null, 2),
          "utf-8"
        );
        await fs.promises.rename(tmp, notesPath);
      },

      exportNotes: async () => {
        const result = await Utils.openFileDialog({
          canChooseFiles: false,
          canChooseDirectory: true,
          allowsMultipleSelection: false,
        });

        if (!result || result.length === 0) return false;

        try {
          const data = await fs.promises.readFile(notesPath, "utf-8");
          const notes: Array<{ title: string; body: string }> =
            JSON.parse(data);
          const dir = result[0];

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
            await fs.promises.writeFile(
              path.join(dir, `${name}.md`),
              content,
              "utf-8"
            );
          }

          return true;
        } catch {
          return false;
        }
      },

      importTextFiles: async () => {
        const result = await Utils.openFileDialog({
          allowedFileTypes: "txt,md",
          canChooseFiles: true,
          canChooseDirectory: false,
          allowsMultipleSelection: true,
        });

        if (!result || result.length === 0) return [];

        const notes: Array<{ title: string; body: string }> = [];

        for (const filePath of result) {
          try {
            const content = fs.readFileSync(filePath, "utf-8");
            const filename = path.basename(filePath);
            notes.push(parseFile(filename, content));
          } catch {
            // Skip files that can't be read
          }
        }

        return notes;
      },

      listAppleNotes: async () => {
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
      },

      getAppleNoteBodies: async ({ ids }) => {
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
          throw new Error(
            `Failed to fetch note bodies. ${(e as Error).message}`
          );
        }
      },

      loadSettings: () => {
        return currentSettings;
      },

      saveSettings: async ({ settings }) => {
        const oldShortcut = currentSettings.quickCapture.shortcut;
        const wasEnabled = currentSettings.quickCapture.enabled;
        currentSettings = settings;
        const tmp = settingsPath + ".tmp";
        await fs.promises.writeFile(
          tmp,
          JSON.stringify(settings, null, 2),
          "utf-8"
        );
        await fs.promises.rename(tmp, settingsPath);

        // Re-register or unregister the global shortcut
        unregisterHotKey(oldShortcut);
        if (settings.quickCapture.enabled) {
          registerHotKey(
            settings.quickCapture.shortcut,
            toggleQuickCapture
          );
        } else if (wasEnabled) {
          if (quickCaptureWindow) {
            quickCaptureWindow.close();
            quickCaptureWindow = null;
          }
        }
      },

      whisperModelStatus: () => {
        return getInstalledModel();
      },

      downloadWhisperModel: async ({ filename }) => {
        await downloadModel(filename, (progress) => {
          if (mainWindow) {
            mainWindow.webview.rpc.send.whisperDownloadProgress(progress);
          }
        });
      },

      checkWhisperBuildTools,

      rebuildWhisper: rebuildWhisperBinary,

      getWhisperModels: () => {
        return getModelsWithStatus();
      },

      deleteWhisperModel: ({ filename }) => {
        return deleteModel(filename);
      },

      setWhisperModel: ({ filename }) => {
        return setSelectedModel(filename);
      },

      pickAudioFile: async () => {
        const result = await Utils.openFileDialog({
          allowedFileTypes: "mp3,m4a,wav,ogg,webm,flac",
          canChooseFiles: true,
          canChooseDirectory: false,
          allowsMultipleSelection: false,
        });

        if (!result || result.length === 0) return null;
        return result[0];
      },

      transcribeAudio: async ({ filePath }) => {
        return transcribe(filePath, (active) => {
          if (mainWindow) {
            mainWindow.webview.rpc.send.transcriptionProgress({ active });
          }
        });
      },
    },
    messages: {},
  },
});

function createWindow() {
  const win = new BrowserWindow({
    title: "Marginalia",
    frame: { width: 1200, height: 800, x: 100, y: 100 },
    titleBarStyle: "hiddenInset",
    url: getAppUrl(),
    preload: "views://main-bridge/main-bridge.js",
    rpc: mainRpc,
  });

  mainWindow = win;
  showInDock();

  win.on("close", () => {
    mainWindow = null;
    hideFromDock();
  });
}

function showMainWindow() {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  } else {
    createWindow();
    if (mainWindow) {
      mainWindow.focus();
    }
  }
}

// ---------------------------------------------------------------------------
// Quick Capture
// ---------------------------------------------------------------------------

const quickCaptureRpc = BrowserView.defineRPC<QuickCaptureRPC>({
  maxRequestTime: 5000,
  handlers: {
    requests: {
      quickCaptureSave: async ({ title, body }) => {
        const note: Note = {
          id: crypto.randomUUID(),
          title,
          body,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        let notes: Note[] = [];
        try {
          const data = await fs.promises.readFile(notesPath, "utf-8");
          notes = JSON.parse(data);
        } catch {
          // No existing file — start fresh
        }

        notes.unshift(note);

        const tmp = notesPath + ".tmp";
        await fs.promises.writeFile(
          tmp,
          JSON.stringify(notes, null, 2),
          "utf-8"
        );
        await fs.promises.rename(tmp, notesPath);

        // Notify main window to reload
        if (mainWindow) {
          mainWindow.webview.rpc.send.notesChangedExternally();
        }

        // Hide the popup
        dismissQuickCapture();
      },

      quickCaptureDismiss: () => {
        dismissQuickCapture();
      },
    },
    messages: {},
  },
});

function createQuickCaptureWindow(x: number, y: number) {
  const win = new BrowserWindow({
    title: "Quick Capture",
    frame: { width: 440, height: 220, x, y },
    titleBarStyle: "hiddenInset",
    styleMask: {
      Closable: false,
      Miniaturizable: false,
      Resizable: false,
    },
    url: getAppUrl(),
    preload: "views://quick-capture-bridge/quick-capture-bridge.js",
    rpc: quickCaptureRpc,
  });

  win.setAlwaysOnTop(true);
  win.focus();

  win.on("close", () => {
    quickCaptureWindow = null;
  });

  quickCaptureWindow = win;
}

function toggleQuickCapture() {
  if (quickCaptureWindow) {
    dismissQuickCapture();
    return;
  }

  // Position the window based on settings using screen API
  const display = Screen.getPrimaryDisplay();
  const area = display.workArea;
  const winWidth = 440;
  const winHeight = 220;

  const position = currentSettings.quickCapture.position;
  const margin = 32;

  const colMap: Record<string, number> = {
    left: area.x + margin,
    center: area.x + (area.width - winWidth) / 2,
    right: area.x + area.width - winWidth - margin,
  };
  const rowMap: Record<string, number> = {
    top: area.y + margin,
    center: area.y + (area.height - winHeight) / 2,
    bottom: area.y + area.height - winHeight - margin,
  };

  const parts = position.split("-");
  let row: string, col: string;
  if (parts.length === 1) {
    row = "center";
    col = "center";
  } else {
    row = parts[0];
    col = parts[1];
  }

  const x = Math.round(colMap[col] ?? colMap.center);
  const y = Math.round(rowMap[row] ?? rowMap.center);

  createQuickCaptureWindow(x, y);
}

// ---------------------------------------------------------------------------
// Application Menu
// ---------------------------------------------------------------------------

function buildMenu() {
  ApplicationMenu.setApplicationMenu([
    {
      submenu: [
        { role: "hide" },
        { role: "hideOthers" },
        { role: "showAll" },
        { type: "separator" },
        {
          label: "Settings\u2026",
          accelerator: ",",
          action: "open-settings",
        },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "File",
      submenu: [
        {
          label: "Quick Note",
          action: "quick-capture",
          accelerator: "Shift+N",
        },
        { type: "separator" },
        {
          label: "Import from text files",
          action: "import-text-files",
          accelerator: "Shift+I",
        },
        {
          label: "Import from Apple Notes",
          action: "import-apple-notes",
        },
        {
          label: "Import from audio",
          action: "import-audio",
        },
        { type: "separator" },
        {
          label: "Export all notes\u2026",
          action: "export-notes",
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
      label: "Help",
      submenu: [
        {
          label: "Welcome to Marginalia",
          action: "open-onboarding",
        },
      ],
    },
  ]);

  Electrobun.events.on("application-menu-clicked", (e) => {
    const action = e.data.action;

    switch (action) {
      case "open-settings":
        if (mainWindow) mainWindow.webview.rpc.send.openSettings();
        break;
      case "quick-capture":
        toggleQuickCapture();
        break;
      case "import-text-files":
        handleImportTextFiles();
        break;
      case "import-apple-notes":
        if (mainWindow) mainWindow.webview.rpc.send.openAppleNotesModal();
        break;
      case "import-audio":
        handleImportFromAudio();
        break;
      case "export-notes":
        if (mainWindow) mainWindow.webview.rpc.send.exportNotes();
        break;
      case "open-onboarding":
        if (mainWindow) mainWindow.webview.rpc.send.openOnboarding();
        break;
    }
  });
}

async function handleImportTextFiles() {
  if (!mainWindow) return;

  const result = await Utils.openFileDialog({
    allowedFileTypes: "txt,md",
    canChooseFiles: true,
    canChooseDirectory: false,
    allowsMultipleSelection: true,
  });

  if (!result || result.length === 0) return;

  const notes: Array<{ title: string; body: string }> = [];

  for (const filePath of result) {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const filename = path.basename(filePath);
      notes.push(parseFile(filename, content));
    } catch {
      // Skip files that can't be read
    }
  }

  if (notes.length > 0) {
    mainWindow.webview.rpc.send.importNotes({ notes });
  }
}

function handleImportFromAudio() {
  if (!mainWindow) return;
  const model = getInstalledModel();
  if (model) {
    mainWindow.webview.rpc.send.pickAndTranscribeAudio();
  } else {
    mainWindow.webview.rpc.send.openWhisperSetup();
  }
}

// ---------------------------------------------------------------------------
// System Tray
// ---------------------------------------------------------------------------

function createTray() {
  const tray = new Tray({
    title: "",
    image: "views://assets/trayIconTemplate.png",
    template: true,
    width: 18,
    height: 18,
  });

  tray.setMenu([
    { label: "Show Marginalia", action: "tray-show" },
    { label: "Quick Note", action: "tray-quick-note" },
    { type: "separator" },
    { label: "Quit", action: "tray-quit" },
  ]);

  tray.on("tray-clicked", (e) => {
    switch (e.data.action) {
      case "tray-show":
        showMainWindow();
        break;
      case "tray-quick-note":
        toggleQuickCapture();
        break;
      case "tray-quit":
        Utils.quit();
        break;
    }
  });
}

// ---------------------------------------------------------------------------
// App Initialization
// ---------------------------------------------------------------------------

currentSettings = loadSettings();
buildMenu();
createTray();
createWindow();

if (currentSettings.quickCapture.enabled) {
  registerHotKey(currentSettings.quickCapture.shortcut, toggleQuickCapture);
}

Electrobun.events.on("before-quit", () => {
  isQuitting = true;
  unregisterAllHotKeys();
});

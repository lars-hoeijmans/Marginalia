# Electrobun Migration Plan

## Overview

Migrate Marginalia from Electron to Electrobun v1. The frontend (Next.js static export) stays unchanged. The Electron backend (`electron/`) gets rewritten to use Electrobun's Bun-based main process. Since Electrobun runs on Bun (not Node), most of the existing TypeScript backend logic can be reused with minimal changes.

---

## Architecture Comparison

```
CURRENT (Electron)                    TARGET (Electrobun)
electron/main.ts                      src/bun/main.ts
electron/preload.ts                   (removed - replaced by Electroview RPC)
electron/whisper.ts                   src/bun/whisper.ts
electron/import-parsers.ts            src/bun/import-parsers.ts
electron-serve (npm)                  views:// URL scheme (built-in)
ipcMain.handle / ipcRenderer.invoke   Typed RPC (bun <-> webview)
electron-builder                      electrobun build CLI
next build -> out/                    next build -> out/ (unchanged)
```

---

## Phase 1: Project Scaffolding

### 1.1 Initialize Electrobun alongside existing Electron setup

- Install Electrobun: `bun add electrobun`
- Create `electrobun.config.ts` in project root:
  ```ts
  import type { ElectrobunConfig } from "electrobun";

  export default {
    app: {
      name: "Marginalia",
      identifier: "com.marginalia.app",
      version: "1.0.5",
    },
    runtime: {
      exitOnLastWindowClosed: false, // macOS: keep running for tray
    },
    build: {
      bun: {
        entrypoint: "src/bun/main.ts",
      },
      copy: {
        // Copy the Next.js static export into the views bundle
        "out/": "views/app/",
      },
    },
  } satisfies ElectrobunConfig;
  ```
- Create `src/bun/` directory for the main process code

### 1.2 Update package.json scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "dev:electrobun": "npm run build && bun start",
    "dist": "npm run build && electrobun build"
  }
}
```

### 1.3 Keep Electron files intact during migration

Don't delete `electron/` until Electrobun is fully working. Both can coexist.

---

## Phase 2: Main Window & App Lifecycle

### 2.1 Create `src/bun/main.ts`

Port `electron/main.ts` app lifecycle to Electrobun:

```ts
import { Electrobun, BrowserWindow } from "electrobun/bun";
```

**Window creation mapping:**

| Electron | Electrobun |
|---|---|
| `new BrowserWindow({ width, height, titleBarStyle, ... })` | `new BrowserWindow({ width, height, titleBarStyle: "hiddenInset", ... })` |
| `win.loadURL("app://-")` | `url: "views://app/index.html"` (set in constructor) |
| `win.loadURL("http://localhost:3000")` | Same for dev mode |
| `win.once("ready-to-show", ...)` | `win.on("ready-to-show", ...)` |
| `win.on("closed", ...)` | `win.on("closed", ...)` |

**App lifecycle mapping:**

| Electron | Electrobun |
|---|---|
| `app.whenReady()` | Top-level await in `main.ts` (Bun entrypoint runs immediately) |
| `app.on("before-quit", ...)` | `Electrobun.events.on("will-quit", ...)` |
| `app.on("window-all-closed", ...)` | `runtime.exitOnLastWindowClosed: false` in config |
| `app.on("activate", ...)` | `Electrobun.events.on("activate", ...)` |
| `app.getPath("userData")` | `Electrobun.paths.userData` or use Bun's OS APIs |
| `app.isPackaged` | `Electrobun.isPackaged` or check environment |
| `app.dock?.show()` / `app.dock?.hide()` | Investigate Electrobun dock API (may need workaround) |

### 2.2 Tasks

- [ ] Create `src/bun/main.ts` with main window creation
- [ ] Verify `views://app/index.html` serves the Next.js static export correctly
- [ ] Verify dev mode with `http://localhost:3000` works
- [ ] Confirm `titleBarStyle: "hiddenInset"` renders correctly

---

## Phase 3: IPC -> Typed RPC

This is the most mechanical but important phase. Replace Electron's `ipcMain.handle` / `ipcRenderer.invoke` bridge with Electrobun's typed RPC system.

### 3.1 Define the RPC schema

Create `src/bun/rpc-schema.ts` with a typed interface covering all 20 IPC handlers:

```ts
export type RpcSchema = {
  requests: {
    bun: {
      loadNotes: { params: void; response: unknown[] | null };
      saveNotes: { params: { notes: unknown[] }; response: void };
      exportNotes: { params: void; response: boolean };
      importTextFiles: { params: void; response: Array<{ title: string; body: string }> };
      listAppleNotes: { params: void; response: AppleNote[] };
      getAppleNoteBodies: { params: { ids: string[] }; response: AppleNoteBody[] };
      quickCaptureSave: { params: { title: string; body: string }; response: void };
      quickCaptureDismiss: { params: void; response: void };
      loadSettings: { params: void; response: AppSettings };
      saveSettings: { params: { settings: AppSettings }; response: void };
      whisperModelStatus: { params: void; response: string | null };
      downloadWhisperModel: { params: { filename: string }; response: void };
      getWhisperModels: { params: void; response: WhisperModelInfo[] };
      deleteWhisperModel: { params: { filename: string }; response: WhisperModelInfo[] };
      setWhisperModel: { params: { filename: string }; response: WhisperModelInfo[] };
      pickAudioFile: { params: void; response: string | null };
      transcribeAudio: { params: { filePath: string }; response: { title: string; body: string } };
    };
    webview: {
      // Functions callable from bun -> webview (currently Electron's webContents.send)
    };
  };
  messages: {
    bun: {};
    webview: {
      // One-way messages from bun -> webview
      exportNotes: void;
      importNotes: Array<{ title: string; body: string }>;
      openAppleNotesModal: void;
      openSettings: void;
      openOnboarding: void;
      openWhisperSetup: void;
      pickAndTranscribeAudio: void;
      quickCaptureReset: void;
      notesChangedExternally: void;
      whisperDownloadProgress: { percent: number; downloadedMB: number; totalMB: number };
      transcriptionProgress: { active: boolean };
    };
  };
};
```

### 3.2 Implement RPC handlers in bun main process

Register handlers on the BrowserWindow's `rpc` property:

```ts
const mainWindow = new BrowserWindow({
  // ...
  rpc: {
    handlers: {
      loadNotes: async () => { /* ... */ },
      saveNotes: async ({ notes }) => { /* ... */ },
      // ... all 17 request handlers
    },
  },
});
```

### 3.3 Replace frontend bridge

**Current:** `window.electron.loadNotes()` calls `ipcRenderer.invoke("load-notes")`

**New:** `electroview.rpc.request.loadNotes()` calls the bun handler directly

Create a compatibility layer so the frontend doesn't need massive changes:

**Option A (recommended):** Create a thin adapter that exposes the same `window.electron` API shape but uses Electroview RPC internally. This minimizes frontend changes.

```ts
// src/lib/bridge.ts (loaded in webview)
import { Electroview } from "electrobun/browser";

const electroview = new Electroview<RpcSchema>();

window.electron = {
  loadNotes: () => electroview.rpc.request.loadNotes(),
  saveNotes: (notes) => electroview.rpc.request.saveNotes({ notes }),
  onExportNotes: (cb) => {
    electroview.rpc.on.exportNotes(cb);
    return () => electroview.rpc.off.exportNotes(cb);
  },
  // ... map all methods
};
```

**Option B:** Update all 7 frontend files that reference `window.electron` to use `electroview.rpc` directly. Cleaner long-term but more frontend churn.

### 3.4 Files that reference `window.electron` (need updating with Option B)

1. `src/hooks/useNotes.ts`
2. `src/components/App.tsx`
3. `src/components/QuickCapture.tsx`
4. `src/components/SettingsModal.tsx`
5. `src/components/OnboardingModal.tsx`
6. `src/components/WhisperSetupModal.tsx`
7. `src/components/AppleNotesModal.tsx`

### 3.5 Tasks

- [ ] Create `src/bun/rpc-schema.ts`
- [ ] Implement all RPC request handlers in `src/bun/main.ts`
- [ ] Implement bun -> webview messages (replacing `webContents.send`)
- [ ] Create bridge adapter OR update all 7 frontend files
- [ ] Test every IPC call end-to-end

---

## Phase 4: System Tray

### 4.1 Port tray creation

| Electron | Electrobun |
|---|---|
| `new Tray(nativeImage)` | `Electrobun.Tray.create({ icon, tooltip, menu })` |
| `tray.setContextMenu(Menu.buildFromTemplate([...]))` | Menu items in tray config |
| Template image from `.png` file | Same approach, bundle icon in assets |

### 4.2 Tasks

- [ ] Create tray with context menu (Show Marginalia, Quick Note, Quit)
- [ ] Bundle `trayIconTemplate.png` in Electrobun assets
- [ ] Verify tray icon renders as template image on macOS

---

## Phase 5: Application Menu

### 5.1 Port the menu bar

Electrobun has an `ApplicationMenu` API. Port the current menu structure:

- App menu (About, Settings, Services, Hide, Quit)
- File menu (Quick Capture, Import text, Import Apple Notes, Import audio, Export, Close)
- Edit menu (Undo, Redo, Cut, Copy, Paste, Select All)
- Help menu (Welcome to Marginalia)

### 5.2 Tasks

- [ ] Create application menu using Electrobun's ApplicationMenu API
- [ ] Wire menu item clicks to the correct RPC messages / handlers
- [ ] Verify accelerators work (Cmd+Shift+N, Cmd+Shift+I, Cmd+,)

---

## Phase 6: Global Shortcuts

### 6.1 Port global shortcut registration

| Electron | Electrobun |
|---|---|
| `globalShortcut.register("CmdOrCtrl+Shift+N", cb)` | `GlobalShortcut.register("CommandOrControl+Shift+N", cb)` |
| `globalShortcut.unregister(...)` | `GlobalShortcut.unregister(...)` |
| `globalShortcut.unregisterAll()` | `GlobalShortcut.unregisterAll()` |

### 6.2 Tasks

- [ ] Register Cmd+Shift+N for Quick Capture toggle
- [ ] Handle register/unregister based on settings changes
- [ ] Unregister all on app quit

---

## Phase 7: Quick Capture Window

### 7.1 Port the quick capture popup

This is the trickiest window because it uses special properties:

| Electron property | Electrobun equivalent | Notes |
|---|---|---|
| `frame: false` | `titleBarStyle: "hidden"` or frameless option | Check docs |
| `transparent: true` | May need `styleMask` config | Investigate |
| `alwaysOnTop: true` | `alwaysOnTop: true` | Should be supported |
| `vibrancy: "popover"` | Possibly via native blur plugin | See `electrobun-macos-native-blur` package |
| `skipTaskbar: true` | Check Electrobun window options | May not be directly available |

### 7.2 Vibrancy workaround

A community package exists: `electrobun-macos-native-blur` (github.com/mayfer/electrobun-macos-native-blur). If Electrobun doesn't natively support `vibrancy`, use this or fall back to a semi-transparent CSS background.

### 7.3 Position calculation

The `getPositionCoords()` function uses `screen.getCursorScreenPoint()` and `screen.getDisplayNearestPoint()`. Check if Electrobun exposes screen/display APIs. If not, a fixed position or center-of-screen fallback would work.

### 7.4 Tasks

- [ ] Create quick capture as a second BrowserWindow
- [ ] Investigate frameless + transparent + alwaysOnTop support
- [ ] Implement vibrancy (native or CSS fallback)
- [ ] Port show/hide toggle logic
- [ ] Port position calculation (or simplify)
- [ ] Wire Quick Capture RPC (save, dismiss, reset)
- [ ] Handle blur-to-hide behavior

---

## Phase 8: File Dialogs

### 8.1 Port file dialog calls

Electrobun provides `openFileDialog()`. Port the three dialog usages:

1. **Import text files**: open dialog with `.txt`/`.md` filter, multi-select
2. **Pick audio file**: open dialog with audio format filter, single select
3. **Export notes**: open directory dialog for choosing export folder

### 8.2 Tasks

- [ ] Port import text files dialog
- [ ] Port pick audio file dialog
- [ ] Port export directory picker dialog
- [ ] Verify file filters work correctly

---

## Phase 9: File System Operations

### 9.1 Notes storage

The notes/settings storage uses `fs.readFileSync`, `fs.promises.readFile`, `fs.promises.writeFile`, etc. Bun supports all of these via its Node.js compatibility layer, plus native `Bun.file()` / `Bun.write()` APIs.

**Minimal changes needed.** The existing code should work almost as-is. Just update the `userData` path resolution:

```ts
// Electron
const notesPath = path.join(app.getPath("userData"), "notes.json");

// Electrobun
const notesPath = path.join(Electrobun.paths.userData, "notes.json");
// OR use XDG/macOS standard paths via Bun:
// ~/Library/Application Support/com.marginalia.app/notes.json
```

### 9.2 Tasks

- [ ] Update userData path resolution
- [ ] Verify atomic write pattern (tmp + rename) works in Bun
- [ ] Test notes load/save cycle
- [ ] Test settings load/save cycle

---

## Phase 10: Whisper Integration

### 10.1 Process spawning

`whisper.ts` uses `child_process.execFile` and `https.get`. Bun supports both:

- `execFile` -> `Bun.spawn` or `node:child_process` compat
- `https.get` -> `fetch()` (Bun native) or `node:https` compat
- `fs.createWriteStream` -> `Bun.write` or Node compat

### 10.2 Model download rewrite

The `downloadModel()` function uses raw `https.get` with redirect following. Simplify with `fetch()`:

```ts
async function downloadModel(filename: string, onProgress: (p: Progress) => void) {
  const url = `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${filename}`;
  const response = await fetch(url, { redirect: "follow" });
  const totalBytes = Number(response.headers.get("content-length") || 0);

  // Stream to file with progress
  const dest = path.join(getModelDir(), filename);
  const writer = Bun.file(dest + ".tmp").writer();
  let downloadedBytes = 0;

  for await (const chunk of response.body!) {
    writer.write(chunk);
    downloadedBytes += chunk.length;
    onProgress({ percent: Math.round((downloadedBytes / totalBytes) * 100), ... });
  }

  writer.end();
  fs.renameSync(dest + ".tmp", dest);
}
```

### 10.3 Audio conversion

`afconvert` is spawned via `execFile`. Works the same way in Bun:

```ts
const proc = Bun.spawn(["afconvert", "-f", "WAVE", "-d", "LEI16@16000", "-c", "1", inputPath, tempWav]);
await proc.exited;
```

### 10.4 Whisper binary bundling

Currently bundled via `electron-builder`'s `extraResources`. In Electrobun, use the `copy` config in `electrobun.config.ts` to bundle the whisper binary, then reference it via Electrobun's bundled assets API.

### 10.5 Progress reporting

Currently uses `window.webContents.send("whisper-download-progress", data)`. Replace with Electrobun RPC messages:

```ts
mainWindow.rpc.send.whisperDownloadProgress({ percent, downloadedMB, totalMB });
```

### 10.6 Tasks

- [ ] Port `whisper.ts` to use Bun APIs
- [ ] Rewrite model download with `fetch()` + streaming
- [ ] Port `afconvert` spawning to `Bun.spawn`
- [ ] Port whisper-cli spawning to `Bun.spawn`
- [ ] Bundle whisper-cli binary via Electrobun config
- [ ] Wire progress reporting through RPC messages
- [ ] Test full transcription flow end-to-end

---

## Phase 11: Apple Notes Import

### 11.1 JXA script execution

Currently uses `execFile("osascript", ["-l", "JavaScript", "-e", script])`. This works identically in Bun via `Bun.spawn` or Node compat `execFile`.

### 11.2 Tasks

- [ ] Port `runJxa()` to Bun
- [ ] Test `list-apple-notes` handler
- [ ] Test `get-apple-note-bodies` handler
- [ ] Verify Automation permission prompt still appears

---

## Phase 12: Build & Distribution

### 12.1 Build pipeline

```
Current:  next build -> esbuild electron/ -> electron-builder -> .dmg
Target:   next build -> electrobun build -> .dmg (or .app)
```

### 12.2 Update `electrobun.config.ts` for production

```ts
build: {
  bun: {
    entrypoint: "src/bun/main.ts",
  },
  copy: {
    "out/": "views/app/",
    "resources/bin/whisper-cli": "bin/whisper-cli",
    "resources/trayIconTemplate.png": "assets/trayIconTemplate.png",
    "resources/trayIconTemplate@2x.png": "assets/trayIconTemplate@2x.png",
  },
},
```

### 12.3 Auto-updates

Electrobun has built-in bsdiff-based updates (patches as small as 14KB). Investigate and configure if desired — this would be a significant upgrade over the current setup (which has no auto-update).

### 12.4 Tasks

- [ ] Configure `electrobun.config.ts` for production build
- [ ] Bundle all assets (tray icons, whisper binary)
- [ ] Test `electrobun build` produces a working `.app`
- [ ] Test distribution format (`.dmg` or installer)
- [ ] Optionally configure auto-updates
- [ ] Update `xattr` instruction in README if signing situation changes

---

## Phase 13: Cleanup

### 13.1 Remove Electron

- [ ] Delete `electron/` directory
- [ ] Remove Electron dependencies from `package.json`:
  - `electron`
  - `electron-builder`
  - `electron-serve`
  - `esbuild` (if only used for Electron)
- [ ] Remove Electron-related scripts from `package.json`
- [ ] Remove `electron-builder` config from `package.json` (`"build"` key)
- [ ] Remove `"main": "electron-dist/main.js"` from `package.json`
- [ ] Update README.md with new setup/build instructions
- [ ] Delete `electron-dist/` from `.gitignore` if present

---

## Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| Electrobun lacks macOS vibrancy API | Quick capture looks different | Use `electrobun-macos-native-blur` or CSS fallback |
| No screen/display API for cursor position | Can't position quick capture near cursor | Use fixed position from settings |
| Electrobun v1 has undiscovered bugs | Blockers during migration | Keep Electron code intact, can revert |
| `app.dock.show/hide` not available | Dock icon always visible | Minor UX difference, acceptable |
| Bun Node.js compat gaps | Some `fs` or `child_process` edge cases | Test thoroughly, use Bun-native APIs where possible |
| No `@napi-rs/canvas` support in Bun | PDF export may break if it uses canvas | Check if this dep is actually used at runtime |

---

## Suggested Order of Execution

1. **Phase 1** - Scaffolding (get the project structure right)
2. **Phase 2** - Main window (prove the concept works)
3. **Phase 3** - RPC bridge (this unlocks everything else)
4. **Phase 9** - File system / notes storage (core functionality)
5. **Phase 5** - Application menu
6. **Phase 4** - System tray
7. **Phase 6** - Global shortcuts
8. **Phase 8** - File dialogs
9. **Phase 7** - Quick capture window (most complex, do last)
10. **Phase 10** - Whisper integration
11. **Phase 11** - Apple Notes import
12. **Phase 12** - Build & distribution
13. **Phase 13** - Cleanup

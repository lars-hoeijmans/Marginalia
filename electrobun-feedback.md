# Electron → Electrobun Migration: Issues & Resolutions

Feedback from migrating Marginalia, a note-taking app, from Electron to Electrobun.

---

## 1. `views://` protocol treats query strings as file paths

**Problem:** In Electron, we passed flags to windows via URL query params (e.g. `?quick-capture=1`). Electrobun's `views://` protocol interprets the entire URL — including query strings and hash fragments — as a literal file path, so `views://app/index.html?quick-capture=1` tries to read a file named `index.html?quick-capture=1`.

**Resolution:** Moved flag detection to the preload script. The quick capture preload sets `window.__QUICK_CAPTURE__ = true`, and the React app reads this in a `useEffect` to decide which component to render.

---

## 2. RPC default timeout is 1 second

**Problem:** Long-running operations like Apple Notes import (which runs JXA scripts) silently timed out. No error was thrown — the request just never resolved.

**Resolution:** Set `maxRequestTime` to appropriate values per RPC surface: 30s for the main window, 5s for quick capture. Operations that may take longer (like imports) need even higher timeouts.

---

## 3. RPC send vs request confusion

**Problem:** Sending messages from the Bun backend to a webview didn't work using `webview.rpc.messageName()`.

**Resolution:** The correct pattern is `webview.rpc.send.messageName()`. The `.send` namespace is for fire-and-forget messages, while `.request` is for request/response patterns.

---

## 4. `BrowserWindow` has no `hide()` or `isVisible()`

**Problem:** Electron's `BrowserWindow` has `hide()`, `show()`, and `isVisible()` for toggling window visibility without destroying it. Electrobun's `BrowserWindow` lacks these methods — `show()` is just an alias for `focus()`.

**Resolution:** Destroy the window to "hide" it and recreate it to "show" it. This actually has a RAM benefit since WKWebView memory is fully reclaimed. Window creation is fast because Electrobun uses the system's WKWebView rather than bundling Chromium.

---

## 5. `titleBarStyle: "hidden"` breaks window input

**Problem:** Setting `titleBarStyle: "hidden"` creates a window with no title bar, but the resulting window doesn't accept keyboard or mouse input. It appears on screen but is completely unresponsive.

**Resolution:** Use `titleBarStyle: "hiddenInset"` instead, which keeps the window functional with a transparent title bar. To hide the stoplight (close/minimize/zoom) buttons, pass `styleMask: { Closable: false, Miniaturizable: false, Resizable: false }`. The `styleMask` is spread *before* the `titleBarStyle` overrides in Electrobun's internals, and `hiddenInset` only overrides `Titled` and `FullSizeContentView`, so the `Closable`/`Miniaturizable`/`Resizable` flags are preserved.

---

## 6. Tray event name mismatch

**Problem:** Tray menu items never fired their click handlers. No error was thrown — the handler simply never executed.

**Resolution:** The correct event name is `"tray-clicked"`, not `"tray-item-clicked"`. The `Tray.on()` method accepts only `"tray-clicked"` as the event name. There is no TypeScript error for incorrect event names because the `on` method signature doesn't enforce the event name at the type level (it would be helpful if it did).

```typescript
// Wrong — silently does nothing
tray.on("tray-item-clicked", handler);

// Correct
tray.on("tray-clicked", handler);
```

---

## 7. No dock icon management API

**Problem:** With `exitOnLastWindowClosed: false` (needed for tray-only persistence), the dock icon stays visible even after all windows are closed. The only built-in option is `LSUIElement` in Info.plist, but that permanently hides both the dock icon *and* the menu bar — making the app's application menu inaccessible.

**Resolution:** Used Bun's FFI to call the Objective-C runtime directly, toggling `NSApplication.setActivationPolicy()` between `Regular` (0, shows dock icon) and `Accessory` (1, hides dock icon) at runtime:

```typescript
import { dlopen, FFIType } from "bun:ffi";

const objc = dlopen("/usr/lib/libobjc.A.dylib", {
  objc_getClass: { args: [FFIType.cstring], returns: FFIType.ptr },
  sel_registerName: { args: [FFIType.cstring], returns: FFIType.ptr },
  objc_msgSend: { args: [FFIType.ptr, FFIType.ptr], returns: FFIType.ptr },
});

const objcWithInt = dlopen("/usr/lib/libobjc.A.dylib", {
  objc_msgSend: {
    args: [FFIType.ptr, FFIType.ptr, FFIType.i64],
    returns: FFIType.bool,
  },
});

// Call showInDock() in createWindow(), hideFromDock() in the close handler
```

**Suggestion for Electrobun:** Expose `Electrobun.app.setActivationPolicy()` or a `showInDock` / `hideFromDock` API natively. This is essential for tray-based apps.

---

## 8. No Info.plist customization in config

**Problem:** Electrobun generates `Info.plist` automatically with no way to add custom keys (like `LSUIElement`, `NSAppleEventsUsageDescription`, etc.) through `electrobun.config.ts`.

**Resolution:** Patched Info.plist in the `postBuild` script by finding the generated plist and inserting keys before `</dict>`. This is fragile — if Electrobun changes its build output structure, the path resolution breaks (we initially got the path wrong because `viewsDir` is 3 levels deep from `Contents/`, not 2).

**Suggestion for Electrobun:** Add an `infoPlist` field to the config:
```typescript
app: {
  infoPlist: {
    NSAppleEventsUsageDescription: "...",
  }
}
```

---

## 9. postBuild scripts must be TypeScript (not bash)

**Problem:** Assumed the `postBuild` script could be a bash script. It silently failed.

**Resolution:** Electrobun runs postBuild scripts with `bun`, so they must be TypeScript (or JavaScript). Use Node.js APIs (`fs`, `path`) for file operations.

---

## 10. No `activate` / `reopen` event

**Problem:** In Electron, `app.on('activate')` fires when the user clicks the dock icon while no windows are open — allowing the app to recreate its main window. Electrobun has no equivalent event.

**Resolution:** Rely on the tray menu's "Show Marginalia" option to recreate the window. Combined with the dock icon hiding (issue #7), this is acceptable since there's no dock icon to click when windows are closed. However, an `activate` event would still be useful for apps that keep their dock icon visible.

---

## Summary of suggestions for Electrobun

1. **Add `setActivationPolicy` API** for dock icon toggling — essential for tray apps
2. **Add `infoPlist` config option** for custom plist keys
3. **Add `activate`/`reopen` event** for dock icon click handling
4. **Enforce tray event names at the type level** to prevent silent failures
5. **Document `titleBarStyle: "hidden"` input issue** or fix the underlying WKWebView behavior
6. **Add `hide()` / `isVisible()` to BrowserWindow** — destroy/recreate works but is a workaround
7. **Document the `views://` query string behavior** prominently — it's a common Electron migration pitfall

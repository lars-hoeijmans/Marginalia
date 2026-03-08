# Electrobun Feedback

Feedback from migrating Marginalia, a note-taking app, from Electron to Electrobun.

---

## 1. `titleBarStyle: "hidden"` breaks window input

Setting `titleBarStyle: "hidden"` creates a window that doesn't accept keyboard or mouse input. It appears on screen but is completely unresponsive. The workaround is using `"hiddenInset"` with `styleMask: { Closable: false, Miniaturizable: false }` to get a chromeless window that actually works.

---

## 2. Tray event name is not type-safe

`Tray.on()` accepts any string — passing `"tray-item-clicked"` instead of the correct `"tray-clicked"` silently does nothing with no TypeScript error and no runtime warning. The `on` method should use a string literal union type to catch this at compile time.

---

## 3. No dock icon management API

With `exitOnLastWindowClosed: false`, the dock icon stays visible after all windows close. The only built-in option is `LSUIElement` in Info.plist, but that permanently hides both the dock icon *and* the menu bar. We had to use Bun's FFI to call `NSApplication.setActivationPolicy()` directly via the Objective-C runtime to toggle the dock icon at runtime. Electrobun should expose something like `Electrobun.app.showInDock()` / `hideFromDock()`.

---

## 4. No `activate` / `reopen` event

In Electron, `app.on('activate')` fires when the user clicks the dock icon while no windows are open. Electrobun has no equivalent, so there's no way to reopen a window from the dock.

---

## 5. No Info.plist customization in config

Electrobun generates Info.plist with no way to add custom keys (like `NSAppleEventsUsageDescription`) through `electrobun.config.ts`. We had to patch the plist in a postBuild script, which is fragile. An `infoPlist` field in the config would solve this.

---

## 6. No `hide()` / `isVisible()` on BrowserWindow

`BrowserWindow` has no way to hide a window without destroying it. `show()` is just an alias for `focus()`. The workaround is destroy/recreate, which works but is heavier than a simple visibility toggle.

---

## 7. No tree-shaking — entire SDK bundled into every app

The entire Electrobun SDK (including WebGPU adapter, Updater, CEF bindings) is bundled into every app's `bun/index.js` (~11MB, 292K lines), even when the app only uses `BrowserWindow` + `Tray`. This inflates baseline RAM to ~130MB with zero windows open. Modular imports (e.g. `electrobun/bun/window`, `electrobun/bun/tray`) or tree-shaking support would significantly reduce the footprint for simple apps.

---

## Summary

1. Fix `titleBarStyle: "hidden"` input handling
2. Type-safe tray event names
3. Add `showInDock()` / `hideFromDock()` API
4. Add `activate` / `reopen` event
5. Add `infoPlist` config option
6. Add `hide()` / `isVisible()` to BrowserWindow
7. Support tree-shaking or modular imports to reduce bundle size and RAM

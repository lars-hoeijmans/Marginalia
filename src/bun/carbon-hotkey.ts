/**
 * Global hotkeys via Carbon's RegisterEventHotKey.
 *
 * Unlike Electrobun's built-in GlobalShortcut (which uses
 * NSEvent.addGlobalMonitorForEventsMatchingMask and requires Input Monitoring
 * permissions), Carbon hotkeys work without any special macOS permissions.
 */
import { dlopen, FFIType, JSCallback, ptr, read } from "bun:ffi";

// ---------------------------------------------------------------------------
// Carbon constants
// ---------------------------------------------------------------------------

const kEventClassKeyboard = 0x6b657962; // 'keyb'
const kEventHotKeyPressed = 5;
const kEventParamDirectObject = 0x2d2d2d2d; // '----'
const typeEventHotKeyID = 0x686b6964; // 'hkid'
const noErr = 0;

// Modifier flags (Carbon)
const cmdKey = 0x0100;
const shiftKey = 0x0200;
const optionKey = 0x0800;
const controlKey = 0x1000;

// Signature for our hotkeys (FourCharCode 'marg')
const HOT_KEY_SIGNATURE = 0x6d617267;

// macOS virtual key codes
const KEY_CODES: Record<string, number> = {
  A: 0x00, S: 0x01, D: 0x02, F: 0x03, H: 0x04, G: 0x05, Z: 0x06,
  X: 0x07, C: 0x08, V: 0x09, B: 0x0b, Q: 0x0c, W: 0x0d, E: 0x0e,
  R: 0x0f, Y: 0x10, T: 0x11, "1": 0x12, "2": 0x13, "3": 0x14, "4": 0x15,
  "6": 0x16, "5": 0x17, "=": 0x18, "9": 0x19, "7": 0x1a, "-": 0x1b,
  "8": 0x1c, "0": 0x1d, "]": 0x1e, O: 0x1f, U: 0x20, "[": 0x21,
  I: 0x22, P: 0x23, L: 0x25, J: 0x26, "'": 0x27, K: 0x28, ";": 0x29,
  "\\": 0x2a, ",": 0x2b, "/": 0x2c, N: 0x2d, M: 0x2e, ".": 0x2f,
  "`": 0x32, Space: 0x31, Return: 0x24, Tab: 0x30, Delete: 0x33,
  Escape: 0x35, Backspace: 0x33,
  F1: 0x7a, F2: 0x78, F3: 0x63, F4: 0x76, F5: 0x60, F6: 0x61,
  F7: 0x62, F8: 0x64, F9: 0x65, F10: 0x6d, F11: 0x67, F12: 0x6f,
  F13: 0x69, F14: 0x6b, F15: 0x71, F16: 0x6a, F17: 0x40, F18: 0x4f,
  F19: 0x50, F20: 0x5a,
  Up: 0x7e, Down: 0x7d, Left: 0x7b, Right: 0x7c,
  Home: 0x73, End: 0x77, PageUp: 0x74, PageDown: 0x79,
};

// ---------------------------------------------------------------------------
// FFI bindings
// ---------------------------------------------------------------------------

const carbon = dlopen(
  "/System/Library/Frameworks/Carbon.framework/Carbon",
  {
    GetApplicationEventTarget: {
      args: [],
      returns: FFIType.ptr,
    },
    InstallEventHandler: {
      // (target, handler, numTypes, typeList, userData, outRef) → OSStatus
      args: [FFIType.ptr, FFIType.ptr, FFIType.u32, FFIType.ptr, FFIType.ptr, FFIType.ptr],
      returns: FFIType.i32,
    },
    RemoveEventHandler: {
      args: [FFIType.ptr],
      returns: FFIType.i32,
    },
    RegisterEventHotKey: {
      // (keyCode, modifiers, hotKeyID_as_u64, target, options, outRef) → OSStatus
      // EventHotKeyID is 8-byte struct passed by value → single u64 register on ARM64
      args: [FFIType.u32, FFIType.u32, FFIType.u64, FFIType.ptr, FFIType.u32, FFIType.ptr],
      returns: FFIType.i32,
    },
    UnregisterEventHotKey: {
      args: [FFIType.ptr],
      returns: FFIType.i32,
    },
    GetEventParameter: {
      // (event, name, desiredType, actualType, bufSize, actualSize, outData) → OSStatus
      args: [FFIType.ptr, FFIType.u32, FFIType.u32, FFIType.ptr, FFIType.u32, FFIType.ptr, FFIType.ptr],
      returns: FFIType.i32,
    },
  }
);

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface HotKeyEntry {
  id: number;
  ref: ReturnType<typeof ptr>;
  callback: () => void;
}

// Accelerator string → registration info
const registrations = new Map<string, HotKeyEntry>();
// Numeric ID → callback (for fast lookup in the event handler)
const callbacksById = new Map<number, () => void>();

let nextId = 1;
let installed = false;
let handlerRef: ReturnType<typeof ptr> | null = null;

// Re-usable buffer for reading EventHotKeyID in the callback (8 bytes)
const hotKeyIDBuf = Buffer.alloc(8);

// ---------------------------------------------------------------------------
// Event handler (installed once, shared by all hotkeys)
// ---------------------------------------------------------------------------

const eventHandler = new JSCallback(
  (_nextHandler: number, event: number, _userData: number): number => {
    const status = carbon.symbols.GetEventParameter(
      event,
      kEventParamDirectObject,
      typeEventHotKeyID,
      null,         // actualType — don't need it
      8,            // sizeof(EventHotKeyID)
      null,         // actualSize — don't need it
      ptr(hotKeyIDBuf),
    );

    if (status === noErr) {
      // EventHotKeyID layout: { UInt32 signature, UInt32 id }
      const id = hotKeyIDBuf.readUInt32LE(4);
      const cb = callbacksById.get(id);
      if (cb) cb();
    }

    return noErr;
  },
  {
    args: [FFIType.ptr, FFIType.ptr, FFIType.ptr],
    returns: FFIType.i32,
    threadsafe: true,
  }
);

function ensureHandler() {
  if (installed) return;

  // EventTypeSpec { UInt32 eventClass, UInt32 eventKind } — 8 bytes
  const typeSpec = Buffer.alloc(8);
  typeSpec.writeUInt32LE(kEventClassKeyboard, 0);
  typeSpec.writeUInt32LE(kEventHotKeyPressed, 4);

  const outRef = Buffer.alloc(8); // pointer-sized

  const target = carbon.symbols.GetApplicationEventTarget();

  const status = carbon.symbols.InstallEventHandler(
    target,
    eventHandler.ptr,
    1,              // numTypes
    ptr(typeSpec),
    null,           // userData
    ptr(outRef),
  );

  if (status !== noErr) {
    console.error(`[carbon-hotkey] InstallEventHandler failed: ${status}`);
    return;
  }

  // Read the EventHandlerRef pointer from the output buffer
  handlerRef = read.ptr(ptr(outRef), 0);
  installed = true;
}

// ---------------------------------------------------------------------------
// Accelerator parser
// ---------------------------------------------------------------------------

function parseAccelerator(accelerator: string): { keyCode: number; modifiers: number } | null {
  const parts = accelerator.split("+");
  let modifiers = 0;
  let key: string | null = null;

  for (const part of parts) {
    const lower = part.toLowerCase();
    switch (lower) {
      case "commandorcontrol":
      case "cmdorctrl":
      case "command":
      case "cmd":
      case "meta":
        modifiers |= cmdKey;
        break;
      case "control":
      case "ctrl":
        modifiers |= controlKey;
        break;
      case "shift":
        modifiers |= shiftKey;
        break;
      case "alt":
      case "option":
        modifiers |= optionKey;
        break;
      default:
        key = part;
    }
  }

  if (!key) return null;

  // Normalize the key for lookup
  const normalized = key.length === 1 ? key.toUpperCase() : key;
  const keyCode = KEY_CODES[normalized];

  if (keyCode === undefined) {
    console.error(`[carbon-hotkey] Unknown key: "${key}"`);
    return null;
  }

  return { keyCode, modifiers };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function register(accelerator: string, callback: () => void): boolean {
  if (registrations.has(accelerator)) {
    unregister(accelerator);
  }

  const parsed = parseAccelerator(accelerator);
  if (!parsed) return false;

  ensureHandler();

  const id = nextId++;
  const target = carbon.symbols.GetApplicationEventTarget();

  // Pack EventHotKeyID { signature: u32, id: u32 } into a u64
  const hotKeyID = BigInt(HOT_KEY_SIGNATURE) | (BigInt(id) << 32n);

  // Output buffer for EventHotKeyRef (pointer-sized)
  const outRef = Buffer.alloc(8);

  const status = carbon.symbols.RegisterEventHotKey(
    parsed.keyCode,
    parsed.modifiers,
    hotKeyID,
    target,
    0,            // options
    ptr(outRef),
  );

  if (status !== noErr) {
    console.error(`[carbon-hotkey] RegisterEventHotKey failed for "${accelerator}": ${status}`);
    return false;
  }

  const ref = read.ptr(ptr(outRef), 0);
  registrations.set(accelerator, { id, ref, callback });
  callbacksById.set(id, callback);
  return true;
}

export function unregister(accelerator: string): boolean {
  const entry = registrations.get(accelerator);
  if (!entry) return false;

  const status = carbon.symbols.UnregisterEventHotKey(entry.ref);
  registrations.delete(accelerator);
  callbacksById.delete(entry.id);

  return status === noErr;
}

export function unregisterAll(): void {
  for (const [accelerator] of registrations) {
    unregister(accelerator);
  }
}

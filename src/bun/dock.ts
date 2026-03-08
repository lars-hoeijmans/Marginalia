import { dlopen, FFIType } from "bun:ffi";

// Bind objc_msgSend with two different signatures since bun:ffi
// requires concrete arg lists for each call pattern.
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

const NSApp = objc.symbols.objc_getClass(Buffer.from("NSApplication\0"));
const sharedAppSel = objc.symbols.sel_registerName(
  Buffer.from("sharedApplication\0")
);
const setPolicySel = objc.symbols.sel_registerName(
  Buffer.from("setActivationPolicy:\0")
);

function getApp() {
  return objc.symbols.objc_msgSend(NSApp, sharedAppSel);
}

/** Show app in dock (NSApplicationActivationPolicyRegular = 0) */
export function showInDock() {
  objcWithInt.symbols.objc_msgSend(getApp(), setPolicySel, 0);
}

/** Hide app from dock (NSApplicationActivationPolicyAccessory = 1) */
export function hideFromDock() {
  objcWithInt.symbols.objc_msgSend(getApp(), setPolicySel, 1);
}

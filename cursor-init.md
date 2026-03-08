# Marginalia

## What this project is

Marginalia is a local-first note-taking app with a shared React frontend and two desktop backends:

- Web mode: Next.js static export with browser `localStorage` fallback.
- Desktop mode: a macOS app that stores notes and settings in the native app data directory.

The product goal is intentionally minimal: quick personal note-taking without accounts, sync, folders, or heavy organization features.

## Current stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS v4
- Framer Motion
- Electron for the current stable desktop runtime
- Electrobun for an in-progress native runtime migration

## Important directories

- `src/app`: Next.js entrypoints
- `src/components`: UI, modals, editor, quick capture
- `src/hooks/useNotes.ts`: primary notes state, persistence, undo delete, localStorage fallback
- `src/lib/types.ts`: note types and HTML/plain-text helpers
- `src/lib/electron.d.ts`: shared `window.electron` contract used by the frontend
- `electron/`: current production desktop backend
- `src/bun/`: in-progress Electrobun backend
- `src/bridge/`: Electrobun preload/bridge adapters that preserve the existing frontend API shape
- `scripts/setup-whisper.sh`: whisper native setup for the Electron path
- `scripts/copy-nextjs-output.ts`: copies Next static export into Electrobun build output
- `out/`: generated Next static export artifacts

## How the app works

- The frontend renders either the main app or the quick-capture window based on the `quick-capture=1` URL param in `src/app/page.tsx`.
- The React app still talks to a single interface: `window.electron`.
- In browser mode, `useNotes()` falls back to `localStorage`.
- In Electron mode, `electron/preload.ts` exposes IPC-backed methods on `window.electron`.
- In the Electrobun migration path, `src/bridge/main-bridge.ts` and `src/bridge/quick-capture-bridge.ts` recreate the same API using Electrobun RPC, minimizing frontend churn.

## Core features

- Rich note editing
- Pinning, search, drag reorder
- Undo delete
- Import from text/markdown files
- Apple Notes import via JXA / `osascript`
- Audio transcription via local `whisper.cpp`
- Quick capture popup with global shortcut
- Menu bar tray
- Settings and onboarding flows

## Persistence model

- Browser: notes in `localStorage`
- Desktop: notes in `notes.json` under app user data
- Desktop settings: `settings.json` under app user data
- Whisper model preference: `whisper-prefs.json`
- Whisper models: stored in a user-data `models/` directory

## Branch status: `electrobun`

- This branch currently points at the same committed `HEAD` as `main`; the Electrobun work is local and uncommitted.
- `package.json` adds `electrobun` plus `dev:electrobun` and `dist:electrobun`.
- `src/bun/main.ts` is a substantial Electron-to-Electrobun port: notes/settings storage, menu, tray, quick capture, Apple Notes import, file dialogs, and Whisper integration.
- `src/bun/rpc-schema.ts` defines the new typed RPC surfaces.
- `src/bridge/*.ts` keeps the old frontend contract intact so React files do not need a broad rewrite.
- `electrobun.config.ts` currently points to `src/bun/main-test.ts`, which is only a minimal test window. That means the branch is not fully switched over to the real migrated backend yet.
- `tsconfig.json` excludes `electrobun.config.ts`, `src/bun`, and `src/bridge`, so the new migration code is not covered by the main TypeScript check right now.
- `electron/` remains the stable reference implementation and should be kept until Electrobun is fully validated.

## Key docs

- `README.md`: product overview and stable usage
- `ELECTROBUN_MIGRATION_PLAN.md`: detailed multi-phase migration plan and risk register

## Practical guidance for future edits

- Prefer replacing duplicated logic over adding parallel implementations unless the migration explicitly requires temporary coexistence.
- Treat `electron/` as the known-good baseline for native behavior.
- Treat `src/bun/` as migration code that still needs validation, especially app startup wiring and production packaging.
- Be careful with generated `out/` artifacts; they are build output, not source of truth.

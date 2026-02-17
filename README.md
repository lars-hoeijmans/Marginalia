# Marginalia

A simple note-taking app. Nothing more, nothing less.

![Marginalia](public/screenshot.webp)

Open it. Write something. Close it. Your notes are still there next time. That's it.

No accounts. No cloud. No syncing. No folders, tags, databases, or settings pages. Just you and your thoughts, stored locally on your machine.

Inspired by marginalia — the notes scholars have scribbled in book margins for centuries. Quick, personal, unpretentious.

## What it does

**Writing**
- Rich text editing with **bold**, *italic*, and underline
- Auto-saves as you type — never lose a thought

**Organizing**
- Pin important notes to the top
- Drag-and-drop reorder
- Full-text search across titles and content

**Import & Export**
- Import from `.txt`, `.md`, Apple Notes, or audio via local [Whisper](https://github.com/ggerganov/whisper.cpp) transcription
- Export as `.txt`, `.md`, or PDF — individually or in bulk

**Quick Note** (desktop app)
- Global shortcut (`Cmd + Shift + N`) opens a small floating window
- Jot something down and close — it's saved instantly

**Other**
- Light and dark mode
- Undo accidental deletes
- Menu bar tray for quick access
- Runs in the browser or as a macOS desktop app

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd + N` | New note |
| `Cmd + Shift + N` | Quick Note (desktop) |
| `Cmd + K` | Search notes |
| `Cmd + ,` | Settings (desktop) |
| `Cmd + B` | Bold |
| `Cmd + I` | Italic |
| `Cmd + U` | Underline |
| `Cmd + Z` | Undo delete |

## Tech Stack

- [Next.js 16](https://nextjs.org/) — App Router, static export
- [React 19](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS v4](https://tailwindcss.com/)
- [Framer Motion](https://www.framer.com/motion/)
- [Electron](https://www.electronjs.org/) — macOS desktop app

## Getting Started

```bash
# Install dependencies
npm install

# Run the dev server
npm run dev

# Run the Electron app in dev mode
npm run dev:electron
```

## Building

```bash
# Build the web app
npm run build

# Build and package the macOS app (.dmg)
npm run dist
```

> **Note:** The macOS app is not code-signed. After installing, run:
> ```bash
> xattr -dr com.apple.quarantine /Applications/Marginalia.app
> ```

## License

MIT

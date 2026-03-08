import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import type { WhisperModelInfo, WhisperDownloadProgress } from "./rpc-schema";

const MODEL_DIR_NAME = "models";
const PREFS_FILENAME = "whisper-prefs.json";

export interface ModelCatalogEntry {
  filename: string;
  label: string;
  size: string;
  description: string;
  recommended: boolean;
}

export const MODEL_CATALOG: ModelCatalogEntry[] = [
  {
    filename: "ggml-large-v3-turbo-q5_0.bin",
    label: "Large (Turbo)",
    size: "~574 MB",
    description:
      "Near-perfect accuracy, optimized for Apple Silicon. Best for non-English languages, accented speech, and background noise.",
    recommended: true,
  },
  {
    filename: "ggml-base-q5_1.bin",
    label: "Base",
    size: "~60 MB",
    description:
      "Good accuracy for clear speech in quiet environments. Faster download, lighter on disk.",
    recommended: false,
  },
];

interface WhisperPrefs {
  selectedModel?: string;
}

let userDataPath: string;

export function setUserDataPath(p: string) {
  userDataPath = p;
}

function getPrefsPath(): string {
  return path.join(userDataPath, PREFS_FILENAME);
}

function readPrefs(): WhisperPrefs {
  try {
    const raw = fs.readFileSync(getPrefsPath(), "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writePrefs(prefs: WhisperPrefs): void {
  fs.writeFileSync(getPrefsPath(), JSON.stringify(prefs, null, 2));
}

function getModelDir(): string {
  const dir = path.join(userDataPath, MODEL_DIR_NAME);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

let whisperBinaryPath: string;

export function setWhisperBinaryPath(p: string) {
  whisperBinaryPath = p;
}

function getInstalledModels(): string[] {
  const dir = getModelDir();
  return MODEL_CATALOG.map((m) => m.filename).filter((filename) =>
    fs.existsSync(path.join(dir, filename))
  );
}

export function getInstalledModel(): string | null {
  const installed = getInstalledModels();
  if (installed.length === 0) return null;

  const prefs = readPrefs();
  if (prefs.selectedModel && installed.includes(prefs.selectedModel)) {
    return prefs.selectedModel;
  }

  return installed[0];
}

export function getModelsWithStatus(): WhisperModelInfo[] {
  const installed = getInstalledModels();
  const effective = getInstalledModel();

  return MODEL_CATALOG.map((entry) => ({
    ...entry,
    installed: installed.includes(entry.filename),
    selected: entry.filename === effective,
  }));
}

export function deleteModel(filename: string): WhisperModelInfo[] {
  const modelPath = path.join(getModelDir(), filename);
  if (fs.existsSync(modelPath)) {
    fs.unlinkSync(modelPath);
  }

  const prefs = readPrefs();
  if (prefs.selectedModel === filename) {
    delete prefs.selectedModel;
    writePrefs(prefs);
  }

  return getModelsWithStatus();
}

export function setSelectedModel(filename: string): WhisperModelInfo[] {
  writePrefs({ selectedModel: filename });
  return getModelsWithStatus();
}

export async function downloadModel(
  filename: string,
  onProgress: (progress: WhisperDownloadProgress) => void
): Promise<void> {
  const url = `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${filename}`;
  const dest = path.join(getModelDir(), filename);
  const tempDest = dest + ".tmp";

  const response = await fetch(url, { redirect: "follow" });

  if (!response.ok) {
    throw new Error(`Download failed with status ${response.status}`);
  }

  if (!response.body) {
    throw new Error("No response body");
  }

  const totalBytes = Number(response.headers.get("content-length") || 0);
  let downloadedBytes = 0;

  const writer = Bun.file(tempDest).writer();

  for await (const chunk of response.body) {
    writer.write(chunk);
    downloadedBytes += chunk.length;
    const percent =
      totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0;
    onProgress({
      percent,
      downloadedMB: Math.round(downloadedBytes / 1024 / 1024),
      totalMB: Math.round(totalBytes / 1024 / 1024),
    });
  }

  await writer.end();
  fs.renameSync(tempDest, dest);
}

async function convertToWav(inputPath: string): Promise<string> {
  const tempWav = path.join(os.tmpdir(), `marginalia-${Date.now()}.wav`);

  const proc = Bun.spawn(
    ["afconvert", "-f", "WAVE", "-d", "LEI16@16000", "-c", "1", inputPath, tempWav],
    { stdout: "ignore", stderr: "pipe" }
  );

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`Audio conversion failed: ${stderr}`);
  }

  return tempWav;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function transcribe(
  audioPath: string,
  onTranscriptionProgress: (active: boolean) => void
): Promise<{ title: string; body: string }> {
  const model = getInstalledModel();
  if (!model) {
    throw new Error("No whisper model installed");
  }

  const modelPath = path.join(getModelDir(), model);

  onTranscriptionProgress(true);

  let wavPath: string | null = null;

  try {
    wavPath = await convertToWav(audioPath);

    const proc = Bun.spawn(
      [
        whisperBinaryPath,
        "-m",
        modelPath,
        "-f",
        wavPath,
        "--no-timestamps",
        "-l",
        "auto",
      ],
      { stdout: "pipe", stderr: "pipe" }
    );

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      throw new Error(stderr || `whisper-cli exited with code ${exitCode}`);
    }

    const stdout = await new Response(proc.stdout).text();

    const title = path
      .basename(audioPath, path.extname(audioPath))
      .replace(/[-_]/g, " ");

    const body = stdout
      .trim()
      .split("\n")
      .map((line) => `<p>${escapeHtml(line)}</p>`)
      .join("");

    return { title, body };
  } finally {
    if (wavPath && fs.existsSync(wavPath)) {
      fs.unlinkSync(wavPath);
    }
    onTranscriptionProgress(false);
  }
}

import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { execFileSync } from "node:child_process";
import type { WhisperModelInfo, WhisperDownloadProgress } from "./rpc-schema";

const MODEL_DIR_NAME = "models";
const PREFS_FILENAME = "whisper-prefs.json";
const HUGGING_FACE_BASE_URL =
  "https://huggingface.co/ggerganov/whisper.cpp/resolve/main";
const DIRECT_AUDIO_EXTENSIONS = new Set([".wav", ".mp3", ".flac", ".ogg"]);

export interface ModelCatalogEntry {
  filename: string;
  label: string;
  size: string;
  description: string;
  recommended: boolean;
  coreMlZip?: string;
  coreMlSourceDir?: string;
}

export const MODEL_CATALOG: ModelCatalogEntry[] = [
  {
    filename: "ggml-small-q5_1.bin",
    label: "Small",
    size: "~190 MB",
    description:
      "Fast default for local notes. Much quicker than Large Turbo while still handling clear speech well.",
    recommended: true,
    coreMlZip: "ggml-small-encoder.mlmodelc.zip",
    coreMlSourceDir: "ggml-small-encoder.mlmodelc",
  },
  {
    filename: "ggml-large-v3-turbo-q5_0.bin",
    label: "Large (Turbo)",
    size: "~574 MB",
    description:
      "Highest accuracy option for non-English languages, accented speech, and background noise. Slower than Small.",
    recommended: false,
    coreMlZip: "ggml-large-v3-turbo-encoder.mlmodelc.zip",
    coreMlSourceDir: "ggml-large-v3-turbo-encoder.mlmodelc",
  },
  {
    filename: "ggml-base-q5_1.bin",
    label: "Base",
    size: "~60 MB",
    description:
      "Fastest download and lowest disk use. Best for clear speech in quiet environments.",
    recommended: false,
    coreMlZip: "ggml-base-encoder.mlmodelc.zip",
    coreMlSourceDir: "ggml-base-encoder.mlmodelc",
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

  const coreMlPath = getCoreMlPathForModel(filename);
  if (fs.existsSync(coreMlPath)) {
    fs.rmSync(coreMlPath, { recursive: true, force: true });
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

async function downloadFile(
  url: string,
  dest: string,
  onProgress?: (downloadedBytes: number, totalBytes: number) => void
): Promise<void> {
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
  let writerClosed = false;

  try {
    for await (const chunk of response.body) {
      writer.write(chunk);
      downloadedBytes += chunk.length;
      onProgress?.(downloadedBytes, totalBytes);
    }

    await writer.end();
    writerClosed = true;
    fs.renameSync(tempDest, dest);
  } catch (error) {
    if (!writerClosed) {
      await Promise.resolve(writer.end()).catch(() => {});
    }
    if (fs.existsSync(tempDest)) fs.unlinkSync(tempDest);
    throw error;
  }
}

function getCatalogEntry(filename: string): ModelCatalogEntry | undefined {
  return MODEL_CATALOG.find((entry) => entry.filename === filename);
}

function getCoreMlPathForModel(filename: string): string {
  return path.join(getModelDir(), filename.replace(/\.bin$/, "-encoder.mlmodelc"));
}

async function runCommand(args: string[], errorPrefix: string): Promise<void> {
  const proc = Bun.spawn(args, { stdout: "ignore", stderr: "pipe" });
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`${errorPrefix}: ${stderr || `exit code ${exitCode}`}`);
  }
}

async function installCoreMlEncoder(
  entry: ModelCatalogEntry,
  onProgress: (progress: WhisperDownloadProgress) => void
): Promise<void> {
  if (process.platform !== "darwin" || process.arch !== "arm64") return;
  if (!entry.coreMlZip || !entry.coreMlSourceDir) return;

  const modelDir = getModelDir();
  const targetDir = getCoreMlPathForModel(entry.filename);
  if (fs.existsSync(targetDir)) return;

  const zipPath = path.join(modelDir, entry.coreMlZip);
  const url = `${HUGGING_FACE_BASE_URL}/${entry.coreMlZip}`;

  await downloadFile(url, zipPath, (downloadedBytes, totalBytes) => {
    onProgress({
      percent: totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0,
      downloadedMB: Math.round(downloadedBytes / 1024 / 1024),
      totalMB: Math.round(totalBytes / 1024 / 1024),
    });
  });

  try {
    await runCommand(["unzip", "-q", "-o", zipPath, "-d", modelDir], "Core ML unzip failed");

    const sourceDir = path.join(modelDir, entry.coreMlSourceDir);
    if (!fs.existsSync(sourceDir)) {
      throw new Error(`Core ML encoder missing after unzip: ${entry.coreMlSourceDir}`);
    }

    if (sourceDir !== targetDir) {
      fs.renameSync(sourceDir, targetDir);
    }
  } finally {
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }
  }
}

export async function downloadModel(
  filename: string,
  onProgress: (progress: WhisperDownloadProgress) => void
): Promise<void> {
  const entry = getCatalogEntry(filename);
  const url = `${HUGGING_FACE_BASE_URL}/${filename}`;
  const dest = path.join(getModelDir(), filename);

  await downloadFile(url, dest, (downloadedBytes, totalBytes) => {
    onProgress({
      percent: totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0,
      downloadedMB: Math.round(downloadedBytes / 1024 / 1024),
      totalMB: Math.round(totalBytes / 1024 / 1024),
    });
  });

  if (entry) {
    await installCoreMlEncoder(entry, onProgress);
  }
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

function canDecodeDirectly(inputPath: string): boolean {
  return DIRECT_AUDIO_EXTENSIONS.has(path.extname(inputPath).toLowerCase());
}

function getWhisperThreadCount(): number {
  if (process.platform === "darwin" && process.arch === "arm64") {
    try {
      const output = execFileSync("sysctl", ["-n", "hw.perflevel0.physicalcpu"], {
        encoding: "utf-8",
      });
      const performanceCores = Number.parseInt(output.trim(), 10);
      if (Number.isFinite(performanceCores) && performanceCores > 0) {
        return performanceCores;
      }
    } catch {
      // Fall through to the portable CPU-count fallback.
    }
  }

  return Math.max(4, Math.min(os.cpus().length, 8));
}

function getWhisperArgs(modelPath: string, audioPath: string): string[] {
  return [
    whisperBinaryPath,
    "-m",
    modelPath,
    "-f",
    audioPath,
    "--no-timestamps",
    "-l",
    "auto",
    "-t",
    String(getWhisperThreadCount()),
    "-bs",
    "1",
    "-bo",
    "1",
    "-nf",
    "-fa",
    "-np",
  ];
}

async function runWhisper(modelPath: string, audioPath: string): Promise<string> {
  const proc = Bun.spawn(getWhisperArgs(modelPath, audioPath), {
    stdout: "pipe",
    stderr: "pipe",
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(stderr || `whisper-cli exited with code ${exitCode}`);
  }

  return new Response(proc.stdout).text();
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
    let stdout: string;

    if (canDecodeDirectly(audioPath)) {
      try {
        stdout = await runWhisper(modelPath, audioPath);
      } catch {
        wavPath = await convertToWav(audioPath);
        stdout = await runWhisper(modelPath, wavPath);
      }
    } else {
      wavPath = await convertToWav(audioPath);
      stdout = await runWhisper(modelPath, wavPath);
    }

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

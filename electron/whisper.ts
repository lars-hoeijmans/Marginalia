import { app, BrowserWindow } from "electron";
import path from "node:path";
import fs from "node:fs";
import https from "node:https";
import { execFile } from "node:child_process";
import os from "node:os";

const MODEL_DIR_NAME = "models";
const PREFS_FILENAME = "whisper-prefs.json";

export interface ModelCatalogEntry {
  filename: string;
  label: string;
  size: string;
  description: string;
  recommended: boolean;
}

export interface WhisperModelInfo extends ModelCatalogEntry {
  installed: boolean;
  selected: boolean;
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

function getPrefsPath(): string {
  return path.join(app.getPath("userData"), PREFS_FILENAME);
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
  const dir = path.join(app.getPath("userData"), MODEL_DIR_NAME);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getWhisperBinary(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "bin", "whisper-cli");
  }
  return path.join(__dirname, "..", "resources", "bin", "whisper-cli");
}

function getInstalledModels(): string[] {
  const dir = getModelDir();
  return MODEL_CATALOG
    .map((m) => m.filename)
    .filter((filename) => fs.existsSync(path.join(dir, filename)));
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

export function downloadModel(
  filename: string,
  window: BrowserWindow
): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${filename}`;
    const dest = path.join(getModelDir(), filename);
    const tempDest = dest + ".tmp";

    const file = fs.createWriteStream(tempDest);

    function followRedirects(targetUrl: string, redirectCount: number) {
      if (redirectCount > 5) {
        file.close();
        fs.unlinkSync(tempDest);
        reject(new Error("Too many redirects"));
        return;
      }

      https.get(targetUrl, (response) => {
        if (
          response.statusCode &&
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          response.resume();
          followRedirects(response.headers.location, redirectCount + 1);
          return;
        }

        if (response.statusCode !== 200) {
          file.close();
          fs.unlinkSync(tempDest);
          reject(new Error(`Download failed with status ${response.statusCode}`));
          return;
        }

        const totalBytes = parseInt(
          response.headers["content-length"] || "0",
          10
        );
        let downloadedBytes = 0;

        response.on("data", (chunk: Buffer) => {
          downloadedBytes += chunk.length;
          const percent =
            totalBytes > 0
              ? Math.round((downloadedBytes / totalBytes) * 100)
              : 0;
          window.webContents.send("whisper-download-progress", {
            percent,
            downloadedMB: Math.round(downloadedBytes / 1024 / 1024),
            totalMB: Math.round(totalBytes / 1024 / 1024),
          });
        });

        response.pipe(file);

        file.on("finish", () => {
          file.close(() => {
            fs.renameSync(tempDest, dest);
            resolve();
          });
        });

        file.on("error", (err) => {
          fs.unlinkSync(tempDest);
          reject(err);
        });
      }).on("error", (err) => {
        file.close();
        if (fs.existsSync(tempDest)) fs.unlinkSync(tempDest);
        reject(err);
      });
    }

    followRedirects(url, 0);
  });
}

function convertToWav(inputPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const tempWav = path.join(
      os.tmpdir(),
      `marginalia-${Date.now()}.wav`
    );

    execFile(
      "afconvert",
      ["-f", "WAVE", "-d", "LEI16@16000", "-c", "1", inputPath, tempWav],
      (error) => {
        if (error) {
          reject(
            new Error(`Audio conversion failed: ${error.message}`)
          );
        } else {
          resolve(tempWav);
        }
      }
    );
  });
}

export async function transcribe(
  audioPath: string,
  window: BrowserWindow
): Promise<{ title: string; body: string }> {
  const model = getInstalledModel();
  if (!model) {
    throw new Error("No whisper model installed");
  }

  const modelPath = path.join(getModelDir(), model);
  const binary = getWhisperBinary();

  window.webContents.send("transcription-progress", { active: true });

  let wavPath: string | null = null;

  try {
    wavPath = await convertToWav(audioPath);

    const stdout = await new Promise<string>((resolve, reject) => {
      execFile(
        binary,
        ["-m", modelPath, "-f", wavPath!, "--no-timestamps", "-l", "auto"],
        { maxBuffer: 50 * 1024 * 1024 },
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(stderr || error.message));
          } else {
            resolve(stdout.trim());
          }
        }
      );
    });

    const title = path
      .basename(audioPath, path.extname(audioPath))
      .replace(/[-_]/g, " ");

    const body = stdout
      .split("\n")
      .map((line) => `<p>${escapeHtml(line)}</p>`)
      .join("");

    return { title, body };
  } finally {
    if (wavPath && fs.existsSync(wavPath)) {
      fs.unlinkSync(wavPath);
    }
    window.webContents.send("transcription-progress", { active: false });
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

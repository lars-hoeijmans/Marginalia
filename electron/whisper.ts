import { app, BrowserWindow } from "electron";
import path from "node:path";
import fs from "node:fs";
import https from "node:https";
import { execFile } from "node:child_process";
import os from "node:os";

const MODEL_DIR_NAME = "models";
const MODELS = [
  "ggml-large-v3-turbo-q5_0.bin",
  "ggml-base-q5_1.bin",
] as const;

type ModelFilename = (typeof MODELS)[number];

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

export function getInstalledModel(): string | null {
  const dir = getModelDir();
  for (const model of MODELS) {
    const modelPath = path.join(dir, model);
    if (fs.existsSync(modelPath)) {
      return model;
    }
  }
  return null;
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

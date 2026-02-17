import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fontPath = resolve("/tmp/Caveat.ttf");

GlobalFonts.registerFromPath(fontPath, "Caveat");

function renderIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  // Font size tuned so the "M" fills the square nicely
  const fontSize = Math.round(size * 1.15);
  ctx.font = `${fontSize}px Caveat`;
  ctx.fillStyle = "#000000";
  ctx.textBaseline = "alphabetic";

  const metrics = ctx.measureText("M");
  const textWidth = metrics.width;
  // Center horizontally, vertically align so the glyph sits centered
  const x = (size - textWidth) / 2;
  const y = size * 0.78;

  ctx.fillText("M", x, y);

  // Convert to template image: keep alpha channel, set all RGB to black
  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 0;     // R
    data[i + 1] = 0; // G
    data[i + 2] = 0; // B
    // alpha stays as rendered
  }
  ctx.putImageData(imageData, 0, 0);

  return canvas.toBuffer("image/png");
}

const outDir = resolve(__dirname, "../resources");

writeFileSync(resolve(outDir, "trayIconTemplate.png"), renderIcon(16));
writeFileSync(resolve(outDir, "trayIconTemplate@2x.png"), renderIcon(32));

console.log("Tray icons generated in resources/");

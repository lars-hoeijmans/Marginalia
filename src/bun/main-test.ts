// This file is only for testing. Rename to index.ts to use.
import { BrowserWindow } from "electrobun/bun";

console.log("Starting Marginalia test...");

try {
  console.log("About to create window...");
  const win = new BrowserWindow({
    title: "Marginalia Test",
    frame: { width: 800, height: 600, x: 200, y: 200 },
    url: "https://example.com",
  });
  console.log("Window created successfully");
} catch (e) {
  console.error("Failed to create window:", e);
}

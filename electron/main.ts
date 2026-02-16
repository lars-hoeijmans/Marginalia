import { app, BrowserWindow } from "electron";
import path from "node:path";
import serve from "electron-serve";

const isProd = app.isPackaged;

if (isProd) {
  serve({ directory: path.join(__dirname, "../out") });
}

function createWindow() {
  const win = new BrowserWindow({
    title: "Marginalia",
    width: 1200,
    height: 800,
    show: false,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#FAF7F2",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  win.once("ready-to-show", () => {
    win.show();
  });

  if (isProd) {
    (win as BrowserWindow & { loadURL(url: string): Promise<void> }).loadURL("app://-");
  } else {
    win.loadURL("http://localhost:3000");
    win.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

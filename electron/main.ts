import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  screen,
  Tray,
  type MenuItemConstructorOptions
} from "electron";
import fs from "node:fs";
import path from "node:path";
import type { PetConfig, Point } from "./types";

const WINDOW_WIDTH = 260;
const WINDOW_HEIGHT = 280;
const MOUSE_POLL_INTERVAL_MS = 33;

const defaultConfig: PetConfig = {
  followEnabled: true,
  followMode: "chase",
  speedScale: 1,
  petScale: 1,
  alwaysOnTop: true,
  clickThrough: false,
  skinId: "default",
  lastPosition: { x: 780, y: 560 }
};

let mainWindow: BrowserWindow | null = null;
let panelWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let mouseTimer: NodeJS.Timeout | null = null;
let config = defaultConfig;

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

app.commandLine.appendSwitch("disable-crash-reporter");
app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");
app.disableHardwareAcceleration();
app.setName("Mouse Pet");

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

app.on("second-instance", () => {
  mainWindow?.showInactive();
});

app.whenReady().then(() => {
  console.log("[main] app ready");
  config = loadConfig();
  createWindow();
  createPanelWindow();
  createTray();
  registerIpc();
  startMousePolling();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (mouseTimer) {
    clearInterval(mouseTimer);
  }
});

function createWindow() {
  const position = windowTopLeftFromPetPosition(config.lastPosition);

  mainWindow = new BrowserWindow({
    x: position.x,
    y: position.y,
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    frame: false,
    transparent: true,
    resizable: false,
    hasShadow: false,
    skipTaskbar: true,
    alwaysOnTop: config.alwaysOnTop,
    show: false,
    focusable: true,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false
    }
  });

  mainWindow.setMenu(null);
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.setAlwaysOnTop(config.alwaysOnTop, "screen-saver");
  applyClickThrough(config.clickThrough);

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription) => {
    console.error("[main] did-fail-load", errorCode, errorDescription);
  });

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    console.error("[main] render-process-gone", details.reason, details.exitCode);
  });

  mainWindow.webContents.on("did-finish-load", () => {
    console.log("[main] renderer loaded");
  });

  mainWindow.once("ready-to-show", () => {
    console.log("[main] ready to show");
    mainWindow?.showInactive();
  });

  if (isDev) {
    void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL as string);
  } else {
    void mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

function createPanelWindow() {
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;
  const { x, y } = display.workArea;

  const panelWidth = 170;
  const panelHeight = 160;

  panelWindow = new BrowserWindow({
    x: x + width - panelWidth - 20,
    y: y + height - panelHeight - 20,
    width: panelWidth,
    height: panelHeight,
    frame: false,
    transparent: true,
    resizable: false,
    hasShadow: false,
    skipTaskbar: true,
    alwaysOnTop: config.alwaysOnTop,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (isDev) {
    void panelWindow.loadURL((process.env.VITE_DEV_SERVER_URL as string) + "/panel.html");
  } else {
    void panelWindow.loadFile(path.join(__dirname, "../dist/panel.html"));
  }

  panelWindow.once("ready-to-show", () => {
    panelWindow?.showInactive();
  });
}

function createTray() {
  const iconPath = getAssetPath("assets", "pets", "default", "preview.png");
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon.resize({ width: 16, height: 16 }));
  tray.setToolTip("Mouse Pet");
  tray.setContextMenu(buildContextMenu());
  tray.on("click", () => {
    mainWindow?.showInactive();
  });
}

function registerIpc() {
  ipcMain.handle("config:get", () => config);

  ipcMain.handle("config:set", (_event, patch: Partial<PetConfig>) => {
    config = saveConfig({ ...config, ...sanitizeConfigPatch(patch) });
    applyWindowConfig();
    broadcastConfig();
    tray?.setContextMenu(buildContextMenu());
    return config;
  });

  ipcMain.handle("window:set-click-through", (_event, enabled: boolean) => {
    config = saveConfig({ ...config, clickThrough: Boolean(enabled) });
    applyClickThrough(config.clickThrough);
    broadcastConfig();
    tray?.setContextMenu(buildContextMenu());
    return config;
  });

  ipcMain.handle("window:set-always-on-top", (_event, enabled: boolean) => {
    config = saveConfig({ ...config, alwaysOnTop: Boolean(enabled) });
    mainWindow?.setAlwaysOnTop(config.alwaysOnTop, "screen-saver");
    broadcastConfig();
    tray?.setContextMenu(buildContextMenu());
    return config;
  });

  ipcMain.on("window:set-position", (_event, position: Point) => {
    if (!mainWindow || !Number.isFinite(position.x) || !Number.isFinite(position.y)) return;
    mainWindow.setPosition(Math.round(position.x), Math.round(position.y), false);
  });

  ipcMain.on("menu:show-context", () => {
    Menu.getApplicationMenu()?.popup({ window: mainWindow ?? undefined });
  });

  ipcMain.on("app:quit", () => {
    app.exit(0);
  });

  ipcMain.on("panel:resize", (_event, width: number, height: number) => {
    if (!panelWindow || !Number.isFinite(width) || !Number.isFinite(height)) return;
    const currentBounds = panelWindow.getBounds();
    // Calculate new Y to keep bottom-right anchored
    const newY = currentBounds.y + (currentBounds.height - height);
    panelWindow.setBounds({
      x: currentBounds.x,
      y: newY,
      width: Math.round(width),
      height: Math.round(height)
    });
  });
}

function startMousePolling() {
  mouseTimer = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const point = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(point);
    mainWindow.webContents.send("mouse:position", {
      x: point.x,
      y: point.y,
      workArea: display.workArea
    });
  }, MOUSE_POLL_INTERVAL_MS);
}

function buildContextMenu() {
  const template: MenuItemConstructorOptions[] = [
    {
      label: config.followEnabled ? "Pause follow" : "Resume follow",
      click: () => updateConfig({ followEnabled: !config.followEnabled })
    },
    {
      label: "Follow mode",
      submenu: [
        {
          label: "Chase",
          type: "radio",
          checked: config.followMode === "chase",
          click: () => updateConfig({ followMode: "chase" })
        },
        {
          label: "Companion",
          type: "radio",
          checked: config.followMode === "companion",
          click: () => updateConfig({ followMode: "companion" })
        },
        {
          label: "Lazy",
          type: "radio",
          checked: config.followMode === "lazy",
          click: () => updateConfig({ followMode: "lazy" })
        }
      ]
    },
    { type: "separator" },
    {
      label: "Click through",
      type: "checkbox",
      checked: config.clickThrough,
      click: () => updateConfig({ clickThrough: !config.clickThrough })
    },
    {
      label: "Always on top",
      type: "checkbox",
      checked: config.alwaysOnTop,
      click: () => updateConfig({ alwaysOnTop: !config.alwaysOnTop })
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => app.exit(0)
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  return menu;
}

function updateConfig(patch: Partial<PetConfig>) {
  config = saveConfig({ ...config, ...sanitizeConfigPatch(patch) });
  applyWindowConfig();
  broadcastConfig();
  tray?.setContextMenu(buildContextMenu());
}

function applyWindowConfig() {
  mainWindow?.setAlwaysOnTop(config.alwaysOnTop, "screen-saver");
  applyClickThrough(config.clickThrough);
}

function applyClickThrough(enabled: boolean) {
  mainWindow?.setIgnoreMouseEvents(enabled, { forward: true });
}

function broadcastConfig() {
  mainWindow?.webContents.send("config:changed", config);
  panelWindow?.webContents.send("config:changed", config);
}

function loadConfig(): PetConfig {
  try {
    const parsed = JSON.parse(fs.readFileSync(getConfigPath(), "utf8")) as Partial<PetConfig>;
    return sanitizeConfigPatch({ ...defaultConfig, ...parsed }) as PetConfig;
  } catch {
    return saveConfig(defaultConfig);
  }
}

function saveConfig(nextConfig: PetConfig): PetConfig {
  const safeConfig = sanitizeConfigPatch(nextConfig) as PetConfig;
  fs.mkdirSync(path.dirname(getConfigPath()), { recursive: true });
  fs.writeFileSync(getConfigPath(), JSON.stringify(safeConfig, null, 2));
  return safeConfig;
}

function sanitizeConfigPatch(patch: Partial<PetConfig>): PetConfig {
  const fallback = config ?? defaultConfig;
  const followMode = ["chase", "companion", "lazy"].includes(String(patch.followMode))
    ? patch.followMode
    : fallback.followMode;

  return {
    followEnabled: patch.followEnabled ?? fallback.followEnabled,
    followMode: followMode ?? fallback.followMode,
    speedScale: clampNumber(patch.speedScale, 0.35, 2, fallback.speedScale),
    petScale: clampNumber(patch.petScale, 0.65, 1.3, fallback.petScale),
    alwaysOnTop: patch.alwaysOnTop ?? fallback.alwaysOnTop,
    clickThrough: patch.clickThrough ?? fallback.clickThrough,
    skinId: patch.skinId || fallback.skinId,
    lastPosition: sanitizePoint(patch.lastPosition, fallback.lastPosition)
  };
}

function sanitizePoint(point: Point | undefined, fallback: Point): Point {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    return fallback;
  }
  return { x: point.x, y: point.y };
}

function clampNumber(value: number | undefined, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value as number, min), max);
}

function getConfigPath() {
  return path.join(app.getPath("userData"), "pet-config.json");
}

function getAssetPath(...segments: string[]) {
  return app.isPackaged
    ? path.join(process.resourcesPath, ...segments)
    : path.join(app.getAppPath(), ...segments);
}

function windowTopLeftFromPetPosition(position: Point): Point {
  return {
    x: Math.round(position.x - WINDOW_WIDTH / 2),
    y: Math.round(position.y - (WINDOW_HEIGHT - 20))
  };
}

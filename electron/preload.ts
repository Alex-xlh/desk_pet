import { contextBridge, ipcRenderer } from "electron";
import type { PetConfig, Point } from "./types";

interface ConfigPatch extends Partial<PetConfig> {}

interface MousePayload {
  x: number;
  y: number;
  workArea: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

contextBridge.exposeInMainWorld("petApi", {
  getConfig: () => ipcRenderer.invoke("config:get") as Promise<PetConfig>,
  setConfig: (patch: ConfigPatch) => ipcRenderer.invoke("config:set", patch) as Promise<PetConfig>,
  onConfigChanged: (callback: (config: PetConfig) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, config: PetConfig) => callback(config);
    ipcRenderer.on("config:changed", listener);
    return () => ipcRenderer.removeListener("config:changed", listener);
  },
  onMousePosition: (callback: (payload: MousePayload) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: MousePayload) => callback(payload);
    ipcRenderer.on("mouse:position", listener);
    return () => ipcRenderer.removeListener("mouse:position", listener);
  },
  setWindowPosition: (position: Point) => ipcRenderer.send("window:set-position", position),
  setClickThrough: (enabled: boolean) =>
    ipcRenderer.invoke("window:set-click-through", enabled) as Promise<PetConfig>,
  setAlwaysOnTop: (enabled: boolean) =>
    ipcRenderer.invoke("window:set-always-on-top", enabled) as Promise<PetConfig>,
  resizePanel: (width: number, height: number) => ipcRenderer.send("panel:resize", width, height),
  showContextMenu: () => ipcRenderer.send("menu:show-context"),
  quit: () => ipcRenderer.send("app:quit")
});

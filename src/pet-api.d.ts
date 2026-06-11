import type { ConfigPatch, MousePayload, PetConfig, Point } from "./types";

export {};

declare global {
  interface Window {
    petApi: {
      getConfig: () => Promise<PetConfig>;
      setConfig: (patch: ConfigPatch) => Promise<PetConfig>;
      onConfigChanged: (callback: (config: PetConfig) => void) => () => void;
      onMousePosition: (callback: (payload: MousePayload) => void) => () => void;
      setWindowPosition: (position: Point) => void;
      setClickThrough: (enabled: boolean) => Promise<PetConfig>;
      setAlwaysOnTop: (enabled: boolean) => Promise<PetConfig>;
      resizePanel: (width: number, height: number) => void;
      showContextMenu: () => void;
      quit: () => void;
    };
  }
}

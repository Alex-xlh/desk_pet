import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { ConfigPatch, MousePayload, PetConfig, Point } from './types';

let currentConfig: PetConfig = {
  petScale: 1,
  followEnabled: true,
  followMode: 'chase',
  speedScale: 1,
  alwaysOnTop: true,
  clickThrough: false,
  skinId: 'default',
  lastPosition: { x: 640, y: 420 }
};

let initialized = false;

async function initConfig() {
  if (initialized) return;
  currentConfig = await invoke('get_config');
  initialized = true;
}

window.petApi = {
  getConfig: async () => {
    await initConfig();
    return currentConfig;
  },
  setConfig: async (patch) => {
    currentConfig = { ...currentConfig, ...patch };
    await invoke('set_config', { patch });
    return currentConfig;
  },
  onConfigChanged: (callback) => {
    const unlisten = listen<PetConfig>('config:changed', (event) => {
      currentConfig = event.payload;
      callback(currentConfig);
    });
    return () => { unlisten.then(f => f()); };
  },
  onMousePosition: (callback) => {
    const unlisten = listen<MousePayload>('mouse-position', (event) => {
      callback(event.payload);
    });
    return () => { unlisten.then(f => f()); };
  },
  setWindowPosition: (position) => invoke('set_window_position', position),
  setClickThrough: async (enabled) => {
    await invoke('set_click_through', { enabled });
    return window.petApi.setConfig({ clickThrough: enabled });
  },
  setAlwaysOnTop: async (enabled) => {
    await invoke('set_always_on_top', { enabled });
    return window.petApi.setConfig({ alwaysOnTop: enabled });
  },
  resizePanel: (width, height) => invoke('resize_panel', { width, height }),
  showContextMenu: () => {}, 
  quit: () => invoke('quit')
};

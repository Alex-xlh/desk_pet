import "./tauri-api";
import "./panel.css";
import type { PetConfig } from "./types";

let config: PetConfig;
let scaleInput: HTMLInputElement;
let scaleValue: HTMLSpanElement;
let followEnabledInput: HTMLInputElement;
let followModeInput: HTMLSelectElement;
let clickThroughInput: HTMLInputElement;
let alwaysOnTopInput: HTMLInputElement;

async function start() {
  config = await window.petApi.getConfig();
  
  createControlPanel();
  syncControls();

  window.petApi.onConfigChanged((nextConfig) => {
    config = nextConfig;
    syncControls();
  });
}

function createControlPanel() {
  const panel = document.createElement("section");
  panel.className = "control-panel";
  panel.setAttribute("aria-label", "宠物控制");
  panel.innerHTML = `
    <div class="control-header">
      <strong>宠物控制</strong>
      <div class="control-header-actions">
        <button class="toggle-button" type="button" aria-label="折叠面板">−</button>
        <button class="close-button" type="button" aria-label="关闭应用">×</button>
      </div>
    </div>
    <label class="scale-control">
      <span>大小 <output class="scale-value">100%</output></span>
      <input class="scale-input" type="range" min="0.65" max="1.3" step="0.05" value="1" />
    </label>
    <label class="setting-control" style="display:flex; justify-content:space-between; align-items:center; margin-top: 8px; font-size: 12px;">
      <span>跟随鼠标</span>
      <input class="follow-enabled-input" type="checkbox" />
    </label>
    <label class="setting-control" style="display:flex; justify-content:space-between; align-items:center; margin-top: 8px; font-size: 12px;">
      <span>跟随模式</span>
      <select class="follow-mode-input" style="padding: 2px; border-radius: 4px; border: 1px solid #ccc; background: transparent; font-size: 12px;">
        <option value="chase">追逐</option>
        <option value="companion">陪伴</option>
        <option value="lazy">慵懒</option>
      </select>
    </label>
    <label class="setting-control" style="display:flex; justify-content:space-between; align-items:center; margin-top: 8px; font-size: 12px;">
      <span>鼠标穿透</span>
      <input class="click-through-input" type="checkbox" />
    </label>
    <label class="setting-control" style="display:flex; justify-content:space-between; align-items:center; margin-top: 8px; font-size: 12px;">
      <span>总在最前</span>
      <input class="always-on-top-input" type="checkbox" />
    </label>
    <ul class="control-help" style="margin-top: 10px;">
      <li>左键点击：切换动画</li>
      <li>右键点击：锁定/解锁跟随</li>
      <li>拖动：移动宠物</li>
      <li>托盘：更多设置</li>
    </ul>
  `;

  document.querySelector("#app")?.appendChild(panel);
  
  scaleInput = panel.querySelector<HTMLInputElement>(".scale-input") as HTMLInputElement;
  scaleValue = panel.querySelector<HTMLSpanElement>(".scale-value") as HTMLSpanElement;
  followEnabledInput = panel.querySelector<HTMLInputElement>(".follow-enabled-input") as HTMLInputElement;
  followModeInput = panel.querySelector<HTMLSelectElement>(".follow-mode-input") as HTMLSelectElement;
  clickThroughInput = panel.querySelector<HTMLInputElement>(".click-through-input") as HTMLInputElement;
  alwaysOnTopInput = panel.querySelector<HTMLInputElement>(".always-on-top-input") as HTMLInputElement;
  
  panel.querySelector<HTMLButtonElement>(".close-button")?.addEventListener("click", () => {
    window.petApi.quit();
  });
  
  const toggleButton = panel.querySelector<HTMLButtonElement>(".toggle-button");
  toggleButton?.addEventListener("click", () => {
    const isCollapsed = panel.classList.toggle("collapsed");
    toggleButton.textContent = isCollapsed ? "+" : "−";
    toggleButton.setAttribute("aria-label", isCollapsed ? "展开面板" : "折叠面板");
    
    // Resize panel window
    if (isCollapsed) {
      window.petApi.resizePanel(170, 36); // Header only
    } else {
      window.petApi.resizePanel(170, 280); // Full height + extra space for new controls
    }
  });

  scaleInput.addEventListener("input", () => {
    const petScale = Number(scaleInput.value);
    if (!Number.isFinite(petScale)) return;
    config = { ...config, petScale };
    syncControls();
    void window.petApi.setConfig({ petScale });
  });

  followEnabledInput.addEventListener("change", () => {
    const followEnabled = followEnabledInput.checked;
    config = { ...config, followEnabled };
    syncControls();
    void window.petApi.setConfig({ followEnabled });
  });

  followModeInput.addEventListener("change", () => {
    const followMode = followModeInput.value as PetConfig['followMode'];
    config = { ...config, followMode };
    syncControls();
    void window.petApi.setConfig({ followMode });
  });

  clickThroughInput.addEventListener("change", () => {
    const clickThrough = clickThroughInput.checked;
    config = { ...config, clickThrough };
    syncControls();
    void window.petApi.setClickThrough(clickThrough);
  });

  alwaysOnTopInput.addEventListener("change", () => {
    const alwaysOnTop = alwaysOnTopInput.checked;
    config = { ...config, alwaysOnTop };
    syncControls();
    void window.petApi.setAlwaysOnTop(alwaysOnTop);
  });
}

function syncControls() {
  if (!config) return;
  
  if (scaleInput && scaleValue) {
    scaleInput.value = String(config.petScale);
    scaleValue.textContent = `${Math.round(config.petScale * 100)}%`;
  }
  
  if (followEnabledInput) {
    followEnabledInput.checked = config.followEnabled;
  }
  
  if (followModeInput) {
    followModeInput.value = config.followMode;
  }

  if (clickThroughInput) {
    clickThroughInput.checked = config.clickThrough;
  }

  if (alwaysOnTopInput) {
    alwaysOnTopInput.checked = config.alwaysOnTop;
  }
}

void start().catch((error) => {
  console.error(error);
});

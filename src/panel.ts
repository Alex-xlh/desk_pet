import "./panel.css";
import type { PetConfig } from "./types";

let config: PetConfig;
let scaleInput: HTMLInputElement;
let scaleValue: HTMLSpanElement;

async function start() {
  config = await window.petApi.getConfig();
  
  createControlPanel();
  syncScaleControl();

  window.petApi.onConfigChanged((nextConfig) => {
    config = nextConfig;
    syncScaleControl();
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
    <ul class="control-help">
      <li>左键点击：切换动画</li>
      <li>右键点击：锁定/解锁跟随</li>
      <li>拖动：移动宠物</li>
      <li>托盘：更多设置</li>
    </ul>
  `;

  document.querySelector("#app")?.appendChild(panel);
  
  scaleInput = panel.querySelector<HTMLInputElement>(".scale-input") as HTMLInputElement;
  scaleValue = panel.querySelector<HTMLSpanElement>(".scale-value") as HTMLSpanElement;
  
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
      window.petApi.resizePanel(170, 160); // Full height
    }
  });

  scaleInput.addEventListener("input", () => {
    const petScale = Number(scaleInput.value);
    if (!Number.isFinite(petScale)) return;
    config = { ...config, petScale };
    syncScaleControl();
    void window.petApi.setConfig({ petScale });
  });
}

function syncScaleControl() {
  if (!scaleInput || !scaleValue || !config) return;
  scaleInput.value = String(config.petScale);
  scaleValue.textContent = `${Math.round(config.petScale * 100)}%`;
}

void start().catch((error) => {
  console.error(error);
});

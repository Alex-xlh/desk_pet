import { Application, Assets, AnimatedSprite, Rectangle, Texture } from "pixi.js";
import "./style.css";
import type { MousePayload, PetConfig, PetManifest, Point, Rect } from "./types";

const WINDOW_WIDTH = 260;
const WINDOW_HEIGHT = 280;
const FOLLOW_OFFSET: Point = { x: 86, y: 74 };
const NEAR_DISTANCE = 34;
const WALK_DISTANCE = 150;
const DRAG_START_DISTANCE = 5;
const DRAG_RESUME_DELAY_MS = 650;
const SAVE_POSITION_INTERVAL_MS = 900;
const ACTIVE_ANIMATION = "main";
const SKIN_IDS = ["default", "pray"] as const;
const assetBase = import.meta.env.DEV ? "/assets" : "../assets";

let config: PetConfig;
let manifest: PetManifest;
let app: Application;
let sprite: AnimatedSprite;
let sheetTexture: Texture;
let currentSkinId = "default";
let lastMouse: MousePayload | null = null;
let petPosition: Point = { x: 640, y: 420 };
let velocity: Point = { x: 0, y: 0 };
let dragOffset: Point = { x: 0, y: 0 };
let pointerDownPosition: Point | null = null;
let isDragging = false;
let resumeFollowAt = 0;
let suppressTapUntil = 0;
let lastMouseMoveAt = performance.now();
let lastPositionSaveAt = 0;
let lastSentWindowPosition: Point = { x: Number.NaN, y: Number.NaN };

async function start() {
  config = await window.petApi.getConfig();
  currentSkinId = normalizeSkinId(config.skinId);
  if (currentSkinId !== config.skinId) {
    config = await window.petApi.setConfig({ skinId: currentSkinId });
  }
  manifest = await fetchPetManifest(currentSkinId);
  petPosition = { ...config.lastPosition };

  app = new Application();
  await app.init({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    backgroundAlpha: 0,
    antialias: false,
    autoDensity: true,
    resolution: window.devicePixelRatio || 1
  });

  document.querySelector("#app")?.appendChild(app.canvas);
  await createSprite();
  bindInput();
  bindIpc();

  app.ticker.add(tick);
}

async function fetchPetManifest(skinId: string) {
  const response = await fetch(`${assetBase}/pets/${skinId}/pet.json`);
  if (!response.ok) {
    throw new Error(`Unable to load pet manifest for ${skinId}`);
  }
  return (await response.json()) as PetManifest;
}

async function createSprite() {
  sheetTexture = await Assets.load<Texture>(`${assetBase}/pets/${currentSkinId}/spritesheet.png`);
  sprite = new AnimatedSprite(createTextures(ACTIVE_ANIMATION));
  sprite.anchor.set(manifest.anchor.x, manifest.anchor.y);
  sprite.x = WINDOW_WIDTH / 2;
  sprite.y = WINDOW_HEIGHT - 20;
  sprite.animationSpeed = manifest.animations[ACTIVE_ANIMATION].fps / 60;
  sprite.eventMode = "static";
  sprite.cursor = "grab";
  sprite.play();
  applyCurrentScale();
  app.stage.addChild(sprite);
}

function createTextures(animationName: string) {
  const animation = manifest.animations[animationName];
  if (!animation) {
    throw new Error(`Missing animation ${animationName}`);
  }

  return Array.from({ length: animation.frames }, (_, index) => {
    const columns = animation.columns ?? animation.frames;
    const column = index % columns;
    const row = animation.row + Math.floor(index / columns);

    return new Texture({
      source: sheetTexture.source,
      frame: new Rectangle(
        column * manifest.frameWidth,
        row * manifest.frameHeight,
        manifest.frameWidth,
        manifest.frameHeight
      )
    });
  });
}

function bindInput() {
  app.canvas.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    void toggleFollowLock();
  });

  sprite.on("pointerdown", () => {
    if (config.clickThrough || !lastMouse) return;
    pointerDownPosition = { x: lastMouse.x, y: lastMouse.y };
    dragOffset = {
      x: lastMouse.x - petPosition.x,
      y: lastMouse.y - petPosition.y
    };
  });

  window.addEventListener("pointerup", (event: PointerEvent) => {
    if (!pointerDownPosition && !isDragging) return;
    const wasDragging = isDragging;
    if (!isDragging && performance.now() >= suppressTapUntil && !config.clickThrough) {
      if (event.button === 0) {
        void switchToNextSkin();
      }
    }
    pointerDownPosition = null;
    isDragging = false;
    sprite.cursor = "grab";
    const now = performance.now();
    if (wasDragging) {
      suppressTapUntil = now + 180;
      resumeFollowAt = now + DRAG_RESUME_DELAY_MS;
    }
  });

  window.addEventListener("blur", () => {
    if (!isDragging && !pointerDownPosition) return;
    pointerDownPosition = null;
    isDragging = false;
    sprite.cursor = "grab";
    resumeFollowAt = performance.now() + DRAG_RESUME_DELAY_MS;
  });
}

function bindIpc() {
  window.petApi.onMousePosition((payload) => {
    if (!lastMouse || lastMouse.x !== payload.x || lastMouse.y !== payload.y) {
      lastMouseMoveAt = performance.now();
    }
    lastMouse = payload;
  });

  window.petApi.onConfigChanged((nextConfig) => {
    config = nextConfig;
    applyCurrentScale();
  });
}

async function switchToNextSkin() {
  const currentIndex = SKIN_IDS.indexOf(currentSkinId as (typeof SKIN_IDS)[number]);
  const nextSkinId = SKIN_IDS[(currentIndex + 1) % SKIN_IDS.length];
  await loadSkin(nextSkinId);
  config = await window.petApi.setConfig({ skinId: nextSkinId });
}

async function loadSkin(skinId: string) {
  currentSkinId = normalizeSkinId(skinId);
  manifest = await fetchPetManifest(currentSkinId);
  sheetTexture = await Assets.load<Texture>(`${assetBase}/pets/${currentSkinId}/spritesheet.png`);
  sprite.textures = createTextures(ACTIVE_ANIMATION);
  sprite.anchor.set(manifest.anchor.x, manifest.anchor.y);
  applyCurrentScale();
  sprite.animationSpeed = manifest.animations[ACTIVE_ANIMATION].fps / 60;
  sprite.gotoAndPlay(0);
}

async function toggleFollowLock() {
  const nextFollowEnabled = !config.followEnabled;
  config = await window.petApi.setConfig({ followEnabled: nextFollowEnabled });
  if (!nextFollowEnabled) {
    velocity = { x: 0, y: 0 };
  }
}

function tick() {
  const now = performance.now();
  const canFollow = config.followEnabled && now >= resumeFollowAt;

  if (lastMouse && pointerDownPosition && !isDragging) {
    const pointerDistance = Math.hypot(
      lastMouse.x - pointerDownPosition.x,
      lastMouse.y - pointerDownPosition.y
    );
    if (pointerDistance > DRAG_START_DISTANCE) {
      isDragging = true;
      sprite.cursor = "grabbing";
    }
  }

  if (lastMouse && isDragging) {
    petPosition = clampToWorkArea(
      {
        x: lastMouse.x - dragOffset.x,
        y: lastMouse.y - dragOffset.y
      },
      lastMouse.workArea
    );
    velocity = { x: 0, y: 0 };
  } else if (lastMouse && canFollow) {
    updateFollow(lastMouse, now);
  } else if (!isDragging) {
    velocity.x *= 0.84;
    velocity.y *= 0.84;
  }

  updateFacing();
  sendWindowPosition();
  savePositionOccasionally(now);
}

function updateFollow(mouse: MousePayload, now: number) {
  const target = applyFollowMode(mouse);
  const dx = target.x - petPosition.x;
  const dy = target.y - petPosition.y;
  const distance = Math.hypot(dx, dy);

  if (distance < NEAR_DISTANCE) {
    velocity.x *= 0.76;
    velocity.y *= 0.76;
    if (Math.hypot(velocity.x, velocity.y) < 0.16) {
      velocity = { x: 0, y: 0 };
    }
  } else {
    const isFar = distance > WALK_DISTANCE;
    const acceleration = isFar ? 0.82 : 0.34;
    const maxSpeed = (isFar ? 13 : 5.8) * config.speedScale;
    velocity.x += (dx / distance) * acceleration * config.speedScale;
    velocity.y += (dy / distance) * acceleration * config.speedScale;
    velocity = limitVector(velocity, maxSpeed);
    velocity.x *= 0.9;
    velocity.y *= 0.9;
    petPosition.x += velocity.x;
    petPosition.y += velocity.y;
  }

  if (config.followMode === "lazy" && now - lastMouseMoveAt < 420) {
    velocity.x *= 0.86;
    velocity.y *= 0.86;
  }

  petPosition = clampToWorkArea(petPosition, mouse.workArea);
}

function applyFollowMode(mouse: MousePayload): Point {
  if (config.followMode === "companion") {
    return { x: mouse.x + FOLLOW_OFFSET.x, y: mouse.y + FOLLOW_OFFSET.y };
  }

  if (config.followMode === "lazy") {
    return { x: mouse.x - 110, y: mouse.y + 96 };
  }

  return { x: mouse.x - FOLLOW_OFFSET.x, y: mouse.y + FOLLOW_OFFSET.y };
}

function updateFacing() {
  const horizontalVelocity = velocity.x;
  if (Math.abs(horizontalVelocity) < 0.12) return;
  const scale = manifest.defaultScale * config.petScale;
  sprite.scale.x = horizontalVelocity > 0 ? Math.abs(scale) : -Math.abs(scale);
  sprite.scale.y = Math.abs(scale);
}

function sendWindowPosition() {
  const topLeft = {
    x: Math.round(petPosition.x - WINDOW_WIDTH / 2),
    y: Math.round(petPosition.y - (WINDOW_HEIGHT - 20))
  };

  if (
    Math.abs(topLeft.x - lastSentWindowPosition.x) < 1 &&
    Math.abs(topLeft.y - lastSentWindowPosition.y) < 1
  ) {
    return;
  }

  lastSentWindowPosition = topLeft;
  window.petApi.setWindowPosition(topLeft);
}

function savePositionOccasionally(now: number) {
  if (now - lastPositionSaveAt < SAVE_POSITION_INTERVAL_MS) return;
  lastPositionSaveAt = now;
  void window.petApi.setConfig({ lastPosition: { ...petPosition } });
}

function clampToWorkArea(point: Point, workArea: Rect): Point {
  const halfWidth = WINDOW_WIDTH / 2;
  // 允许宠物的底部坐标 (petPosition.y) 移动到屏幕更靠上的位置（例如屏幕顶部往下 80 像素处）
  // 这样包含宠物的窗口可以超出屏幕上方，从而让宠物可以出现在屏幕上半部分
  const minPetY = 80;
  return {
    x: clamp(point.x, workArea.x + halfWidth, workArea.x + workArea.width - halfWidth),
    y: clamp(point.y, workArea.y + minPetY, workArea.y + workArea.height - 8)
  };
}

function limitVector(point: Point, maxLength: number): Point {
  const length = Math.hypot(point.x, point.y);
  if (length <= maxLength || length === 0) return point;
  return {
    x: (point.x / length) * maxLength,
    y: (point.y / length) * maxLength
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeSkinId(skinId: string) {
  return SKIN_IDS.includes(skinId as (typeof SKIN_IDS)[number]) ? skinId : SKIN_IDS[0];
}

function applyCurrentScale() {
  if (!sprite || !manifest || !config) return;
  const direction = sprite.scale.x < 0 ? -1 : 1;
  const scale = manifest.defaultScale * config.petScale;
  sprite.scale.x = Math.abs(scale) * direction;
  sprite.scale.y = Math.abs(scale);
}


void start().catch((error) => {
  console.error(error);
});

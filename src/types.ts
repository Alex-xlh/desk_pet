export type FollowMode = "chase" | "companion" | "lazy";

export interface Point {
  x: number;
  y: number;
}

export interface Rect extends Point {
  width: number;
  height: number;
}

export interface PetConfig {
  followEnabled: boolean;
  followMode: FollowMode;
  speedScale: number;
  petScale: number;
  alwaysOnTop: boolean;
  clickThrough: boolean;
  skinId: string;
  lastPosition: Point;
}

export interface PetManifest {
  name: string;
  frameWidth: number;
  frameHeight: number;
  defaultScale: number;
  anchor: Point;
  animations: Record<string, { row: number; frames: number; fps: number; columns?: number }>;
}

export interface MousePayload {
  x: number;
  y: number;
  workArea: Rect;
}

export type ConfigPatch = Partial<PetConfig>;

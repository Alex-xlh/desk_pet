export type FollowMode = "chase" | "companion" | "lazy";

export interface Point {
  x: number;
  y: number;
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

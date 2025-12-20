import type { ImageSource } from 'pixi.js';

export type PuzzleSpritesheet = {
  image: ImageBitmap;
  alphaData: Uint8ClampedArray;
};

export type PuzzleSpritesheetTexture = Omit<PuzzleSpritesheet, 'image'> & {
  source: ImageSource;
};

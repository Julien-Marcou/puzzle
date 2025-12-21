import type { ImageSource } from 'pixi.js';

export type PuzzleSpritesheetImage = {
  image: ImageBitmap;
  alphaData: Uint8ClampedArray;
  pieceOffsetX: number;
  pieceOffsetY: number;
  horizontalPieceCount: number;
  verticalPieceCount: number;
  spriteSize: number;
};

export type PuzzleSpritesheetTexture = Omit<PuzzleSpritesheetImage, 'image'> & {
  source: ImageSource;
};

import type { Point } from './geometry';

export type PuzzleSpritesheetParameters = {
  image: ImageBitmap;
  imageOffset: Point;
  pieceSize: number;
  pieceMargin: number;
  pieceSpriteSize: number;
  horizontalPieceCount: number;
  verticalPieceCount: number;
};

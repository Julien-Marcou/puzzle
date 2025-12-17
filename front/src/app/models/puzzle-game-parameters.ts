import type { Point } from './geometry';

export type PuzzleGameParameters = {
  puzzleImage: ImageBitmap;
  puzzleOffset: Point;
  pieceSize: number;
  horizontalPieceCount: number;
  verticalPieceCount: number;
};

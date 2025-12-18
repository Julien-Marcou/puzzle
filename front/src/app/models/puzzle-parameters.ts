import type { Point } from './geometry';

export type PuzzleSizeParameters = {
  puzzleOffset: Point;
  pieceSize: number;
  horizontalPieceCount: number;
  verticalPieceCount: number;
};

export type PuzzleGameParameters = PuzzleSizeParameters & {
  puzzleImage: ImageBitmap;
};

export type PuzzleSpritesheetParameters = PuzzleGameParameters & {
  pieceMargin: number;
  pieceSpriteSize: number;
};

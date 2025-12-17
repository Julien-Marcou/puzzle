import type { PuzzleGameParameters } from './puzzle-game-parameters';

export type PuzzleSpritesheetParameters = PuzzleGameParameters & {
  pieceMargin: number;
  pieceSpriteSize: number;
};

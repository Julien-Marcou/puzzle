import type { PuzzleGameParameters, PuzzleSizeParameters } from '../models/puzzle-parameters';

import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class CurrentPuzzleGameService {

  private id?: string;
  private parameters?: PuzzleGameParameters;

  public setId(puzzleId: string): void {
    this.id = puzzleId;
  }

  public getId(): string | undefined {
    return this.id;
  }

  public setParameters(puzzleImage: ImageBitmap, puzzleSizeParameters: PuzzleSizeParameters): void {
    this.parameters = { puzzleImage, ...puzzleSizeParameters };
  }

  public getParameters(): PuzzleGameParameters | undefined {
    return this.parameters;
  }

}

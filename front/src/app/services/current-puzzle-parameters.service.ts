import type { PuzzleGameParameters } from '../models/puzzle-game-parameters';

import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class CurrentPuzzleGameService {

  private parameters?: PuzzleGameParameters;

  public setParameters(parameters: PuzzleGameParameters): void {
    this.parameters = parameters;
  }

  public getParameters(): PuzzleGameParameters | undefined {
    return this.parameters;
  }

}

import type { PuzzleGameParameters } from '../models/puzzle-parameters';
import type { ResolveFn } from '@angular/router';

import { inject } from '@angular/core';
import { RedirectCommand, Router } from '@angular/router';

import { CurrentPuzzleGameService } from '../services/current-puzzle-parameters.service';

export const currentPuzzleGameParametersResolver: ResolveFn<PuzzleGameParameters> = () => {
  const router = inject(Router);
  const currentPuzzleGameParameters = inject(CurrentPuzzleGameService).getParameters();
  if (!currentPuzzleGameParameters) {
    return new RedirectCommand(router.createUrlTree(['/']));
  }
  return currentPuzzleGameParameters;
};

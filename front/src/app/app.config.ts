import type { ApplicationConfig } from '@angular/core';
import type { Routes } from '@angular/router';

import { provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { PuzzleFormComponent } from './components/puzzle-form/puzzle-form.component';
import { PuzzleGameComponent } from './components/puzzle-game/puzzle-game.component';
import { currentPuzzleGameParametersResolver } from './resolvers/current-puzzle-game-parameters.resolver';

const APP_ROUTES: Routes = [
  {
    path: '',
    component: PuzzleFormComponent,
  },
  {
    path: 'play',
    component: PuzzleGameComponent,
    resolve: {
      puzzleGameParameters: currentPuzzleGameParametersResolver,
    },
  },
  {
    path: '**',
    redirectTo: '',
  },
];

export const APP_CONFIG: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(APP_ROUTES, withComponentInputBinding()),
  ],
};

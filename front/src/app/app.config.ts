import type { ApplicationConfig } from '@angular/core';
import type { Routes } from '@angular/router';

import { provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { PuzzlePreviewComponent } from './components/puzzle-preview/puzzle-preview.component';

const APP_ROUTES: Routes = [
  {
    path: '',
    component: PuzzlePreviewComponent,
  },
  {
    path: '**',
    redirectTo: '',
  },
];

export const APP_CONFIG: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection(),
    provideBrowserGlobalErrorListeners(),
    provideRouter(APP_ROUTES),
  ],
};

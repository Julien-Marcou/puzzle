import { ApplicationConfig } from '@angular/core';
import { Routes, provideRouter } from '@angular/router';
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
    provideRouter(APP_ROUTES),
  ],
};

import { bootstrapApplication } from '@angular/platform-browser';
import { AbstractRenderer } from 'pixi.js';

import { AppComponent } from './app/app.component';
import { APP_CONFIG } from './app/app.config';

import 'pixi.js/app';
import 'pixi.js/filters';
import 'pixi.js/text';
import 'pixi.js/graphics';
import 'pixi.js/prepare';

AbstractRenderer.defaultOptions.resolution = Math.max(1, window.devicePixelRatio);
AbstractRenderer.defaultOptions.roundPixels = true;

bootstrapApplication(AppComponent, APP_CONFIG).catch((error: unknown) => {
  console.error(error);
});

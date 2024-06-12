import { bootstrapApplication } from '@angular/platform-browser';
import { AbstractRenderer } from 'pixi.js';
import { AppComponent } from './app/app.component';
import { APP_CONFIG } from './app/app.config';

/* eslint-disable import/no-unresolved */
import 'pixi.js/app';
import 'pixi.js/filters';
import 'pixi.js/text';
import 'pixi.js/graphics';
/* eslint-enable import/no-unresolved */

AbstractRenderer.defaultOptions.resolution = Math.max(1, window.devicePixelRatio);

bootstrapApplication(AppComponent, APP_CONFIG).catch((err) => console.error(err));

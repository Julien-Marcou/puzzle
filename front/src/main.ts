import { bootstrapApplication } from '@angular/platform-browser';
import { settings, ENV, SCALE_MODES, BaseTexture } from '@pixi/core';
// import * as PIXI from 'pixi.js';
import { AppComponent } from './app/app.component';
import { APP_CONFIG } from './app/app.config';

settings.RESOLUTION = Math.max(1, window.devicePixelRatio);
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
settings.RENDER_OPTIONS!.autoDensity = true;
settings.PREFER_ENV = ENV.WEBGL2;
settings.FILTER_RESOLUTION = settings.RESOLUTION;
BaseTexture.defaultOptions.resolution = settings.RESOLUTION;
BaseTexture.defaultOptions.scaleMode = SCALE_MODES.NEAREST;
// eslint-disable-next-line
// (window as any).__PIXI_INSPECTOR_GLOBAL_HOOK__?.register({ PIXI: PIXI });

bootstrapApplication(AppComponent, APP_CONFIG).catch((err) => console.error(err));

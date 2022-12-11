import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { settings, ENV, SCALE_MODES } from '@pixi/core';
// import * as PIXI from 'pixi.js';
import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

settings.RESOLUTION = Math.max(1, window.devicePixelRatio);
settings.RENDER_OPTIONS.autoDensity = true;
settings.PREFER_ENV = ENV.WEBGL2;
settings.FILTER_RESOLUTION = settings.RESOLUTION;
settings.SCALE_MODE = SCALE_MODES.NEAREST;
// eslint-disable-next-line
// (window as any).__PIXI_INSPECTOR_GLOBAL_HOOK__?.register({ PIXI: PIXI });

if (environment.production) {
  enableProdMode();
}

platformBrowserDynamic().bootstrapModule(AppModule)
  .catch((err) => console.error(err));

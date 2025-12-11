import type { PuzzleSpritesheetParameters } from './puzzle-spritesheet-parameters';

import { PuzzleSpritesheetBuilder } from './puzzle-spritesheet-builder';

addEventListener('message', ({ data }: MessageEvent<PuzzleSpritesheetParameters>): void => {
  const spritesheetBuilder = new PuzzleSpritesheetBuilder(data);
  spritesheetBuilder.build()
    .then((spritesheet) => {
      postMessage(spritesheet);
    })
    .catch((error: unknown) => {
      console.error(error);
      postMessage(null);
    });
});

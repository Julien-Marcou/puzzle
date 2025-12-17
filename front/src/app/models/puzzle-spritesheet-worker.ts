import type { PuzzleSpritesheetParameters } from './puzzle-spritesheet-parameters';

import { PuzzleSpritesheetBuilder } from './puzzle-spritesheet-builder';

addEventListener('message', ({ data }: MessageEvent<PuzzleSpritesheetParameters>): void => {
  const spritesheetBuilder = new PuzzleSpritesheetBuilder(data);
  const spritesheet = spritesheetBuilder.build();
  postMessage(spritesheet, { transfer: [spritesheet.image, spritesheet.alphaData.buffer] });
});

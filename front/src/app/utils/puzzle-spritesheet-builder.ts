import type { PuzzleSpritesheetParameters } from '../models/puzzle-parameters';
import type { PuzzleSpritesheet, PuzzleSpritesheetTexture } from '../models/puzzle-spritesheet';
import type { Application } from 'pixi.js';

import { ImageSource } from 'pixi.js';

export class PuzzleSpritesheetBuilder {

  constructor(private readonly application: Application, private readonly parameters: PuzzleSpritesheetParameters) {}

  public async buildTexture(): Promise<PuzzleSpritesheetTexture> {
    // Cloning original image, so that we can transfer it to the worker, and still be able to use it on the frontend
    const clonedImage = await createImageBitmap(this.parameters.puzzleImage);

    // Create worker
    const worker = new Worker(new URL('./puzzle-spritesheet-worker', import.meta.url));
    const parameters: PuzzleSpritesheetParameters = {
      ...this.parameters,
      puzzleImage: clonedImage,
    };
    worker.postMessage(parameters, { transfer: [clonedImage] });

    // Wait for result
    const { image, ...rest } = await new Promise<PuzzleSpritesheet>((resolve, reject) => {
      worker.onmessage = ({ data }: MessageEvent<PuzzleSpritesheet | null>): void => {
        if (data) {
          resolve(data);
        }
        else {
          reject(new Error('Spritesheet build error'));
        }
      };
    });

    // Convert spritesheet to pixijs texture
    const source = new ImageSource({
      resource: image,
      autoGenerateMipmaps: true,
      resolution: 1,
      minFilter: 'linear',
      magFilter: 'linear',
      mipmapFilter: 'linear',
      sampleCount: 8,
      antialias: true,
    });

    // Cleanup resources
    await this.application.renderer.prepare.upload(source);
    worker.terminate();
    clonedImage.close();
    image.close();

    return { source, ...rest };
  }

}

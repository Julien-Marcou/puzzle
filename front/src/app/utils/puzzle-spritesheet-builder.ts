import type { PuzzleSpritesheetParameters } from '../models/puzzle-parameters';
import type { PuzzleSpritesheetImage, PuzzleSpritesheetTexture } from '../models/puzzle-spritesheet';
import type { Application } from 'pixi.js';

import { ImageSource } from 'pixi.js';

export class PuzzleSpritesheetBuilder {

  constructor(private readonly application: Application, private readonly parameters: PuzzleSpritesheetParameters) {}

  public async buildTexture(): Promise<PuzzleSpritesheetTexture[]> {
    // Cloning original image, so that we can transfer it to the worker, and still be able to use it on the frontend
    const clonedPuzzleImage = await createImageBitmap(this.parameters.puzzleImage);

    // Create worker
    const worker = new Worker(new URL('./puzzle-spritesheet-worker', import.meta.url));
    const parameters: PuzzleSpritesheetParameters = {
      ...this.parameters,
      puzzleImage: clonedPuzzleImage,
    };
    worker.postMessage(parameters, { transfer: [clonedPuzzleImage] });

    // Wait for result
    const puzzleSpritesheets = await new Promise<PuzzleSpritesheetImage[]>((resolve, reject) => {
      worker.onmessage = ({ data }: MessageEvent<PuzzleSpritesheetImage[] | null>): void => {
        if (data) {
          resolve(data);
        }
        else {
          reject(new Error('Spritesheet build error'));
        }
      };
    });

    // Convert spritesheets to textures
    const puzzleTextures: PuzzleSpritesheetTexture[] = [];
    for (const { image, ...rest } of puzzleSpritesheets) {
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
      puzzleTextures.push({ source, ...rest });

      // Upload texture to gpu so we can free up some memory as soon as possible
      await this.application.renderer.prepare.upload(source);
      image.close();
    }

    // Cleanup resources
    worker.terminate();
    clonedPuzzleImage.close();

    return puzzleTextures;
  }

}

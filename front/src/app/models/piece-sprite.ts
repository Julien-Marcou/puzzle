import { OutlineFilter } from '@pixi/filter-outline';
import { Sprite } from 'pixi.js';

import type { Texture } from 'pixi.js';
import type { Point } from './geometry';

export class PieceSprite extends Sprite {

  private readonly transparentThreshold = 80;
  private locked = false;

  constructor(
    public readonly cell: Readonly<Point>,
    texture: Texture,
    private readonly alphaChannel: ReadonlyArray<Uint8ClampedArray>,
  ) {
    super(texture);
  }

  public isPointInBoundingBox(point: Point): boolean {
    return (
      point.x >= this.x &&
      point.y >= this.y &&
      point.x < this.x + this.width &&
      point.y < this.y + this.height
    );
  }

  public isPixelTransparentAt(point: Point): boolean {
    const x = Math.floor(point.x - this.x);
    const y = Math.floor(point.y - this.y);
    return this.alphaChannel[x][y] < this.transparentThreshold;
  }

  public lock(): void {
    this.locked = true;
  }

  public isLocked(): boolean {
    return this.locked;
  }

  public addOutline(): void {
    if (!this.filters) {
      this.filters = [
        new OutlineFilter(2, 0x000000, 0.1),
        new OutlineFilter(2, 0xffffff, 0.1),
      ];
      // this.cacheAsBitmap = true;
    }
  }

  public removeOutline(): void {
    if (this.filters) {
      this.filters = null;
      // this.cacheAsBitmap = false;
    }
  }

}

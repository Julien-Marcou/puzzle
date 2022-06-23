import { Sprite } from 'pixi.js';
import type { Point } from '../models/geometry';
import type { Texture } from 'pixi.js';

export class PieceSprite extends Sprite {

  private readonly transparentThreshold = 80;

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

}

import type { PieceGroup } from './piece-group';
import type { Point } from '../models/geometry';
import type { TextureSource } from 'pixi.js';

import { Texture, Sprite, Rectangle } from 'pixi.js';

export class PieceSprite extends Sprite {

  declare public readonly parent: PieceGroup;

  private readonly transparentThreshold = 80;

  constructor(
    public readonly cell: Readonly<Point>,
    size: number,
    puzzleTexture: TextureSource,
    private readonly alphaChannel: ReadonlyArray<Uint8ClampedArray>,
  ) {
    super(new Texture({
      source: puzzleTexture,
      frame: new Rectangle(cell.x * size, cell.y * size, size, size),
    }));
  }

  public isPointInBoundingBox(point: Point): boolean {
    return (
      point.x >= this.x
      && point.y >= this.y
      && point.x < this.x + this.width
      && point.y < this.y + this.height
    );
  }

  public isPixelTransparentAt(point: Point): boolean {
    const x = Math.floor(point.x - this.x);
    const y = Math.floor(point.y - this.y);
    return this.alphaChannel[x][y] < this.transparentThreshold;
  }

}

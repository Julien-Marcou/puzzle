import type { PieceGroup } from './piece-group';
import type { Point } from '../models/geometry';

import { Texture, Sprite } from 'pixi.js';

export class PieceSprite extends Sprite {

  declare public parent: PieceGroup;

  private readonly transparentThreshold = 80;

  constructor(
    public readonly cell: Readonly<Point>,
    pieceImage: ImageBitmap,
    private readonly alphaChannel: ReadonlyArray<Uint8ClampedArray>,
  ) {
    const texture = Texture.from(pieceImage);
    texture.source.resolution = 1;
    texture.source.scaleMode = 'linear';
    // texture.source.antialias = true;
    // texture.source.sampleCount = MSAA_QUALITY.HIGH;
    texture.source.autoGenerateMipmaps = true;
    super(texture);
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

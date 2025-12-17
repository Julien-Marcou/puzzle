import type { PieceGroup } from './piece-group';
import type { Point } from '../models/geometry';
import type { TextureSource } from 'pixi.js';

import { Texture, Sprite, Rectangle } from 'pixi.js';

export class PieceSprite extends Sprite {

  declare public readonly parent: PieceGroup;

  private readonly transparentThreshold = 80;
  private readonly textureOrigin: Point;

  constructor(
    public readonly cell: Readonly<Point>,
    size: number,
    private readonly puzzleTexture: TextureSource,
    private readonly puzzleAlphaData: Uint8ClampedArray,
  ) {
    const textureOrigin = { x: cell.x * size, y: cell.y * size };
    super(new Texture({
      source: puzzleTexture,
      frame: new Rectangle(textureOrigin.x, textureOrigin.y, size, size),
    }));
    this.textureOrigin = textureOrigin;
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
    // Position of the point relative to the sprite
    const spriteX = Math.floor(point.x - this.x);
    const spriteY = Math.floor(point.y - this.y);

    // Position of the point relative to the spritesheet
    const spritesheetX = this.textureOrigin.x + spriteX;
    const spritesheetY = this.textureOrigin.y + spriteY;

    // Convert position to index, because puzzleAlphaData is a 1D array representation of the alpha channel values of the spritesheet's pixels
    const pixelIndex = this.puzzleTexture.width * spritesheetY + spritesheetX;
    return this.puzzleAlphaData[pixelIndex] < this.transparentThreshold;
  }

}

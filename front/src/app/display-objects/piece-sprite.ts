import type { PieceGroup } from './piece-group';
import type { Point } from '../models/geometry';
import type { PuzzleSpritesheetTexture } from '../models/puzzle-spritesheet';

import { Rectangle, Texture, Sprite } from 'pixi.js';

export class PieceSprite extends Sprite {

  declare public readonly parent: PieceGroup;

  public readonly cell: Readonly<Point>;

  private readonly transparentThreshold = 80;

  constructor(
    spriteX: number,
    spriteY: number,
    private readonly spritesheetTexture: PuzzleSpritesheetTexture,
  ) {
    super(new Texture(
      {
        source: spritesheetTexture.source,
        frame: new Rectangle(
          spriteX * spritesheetTexture.spriteSize,
          spriteY * spritesheetTexture.spriteSize,
          spritesheetTexture.spriteSize,
          spritesheetTexture.spriteSize,
        ),
      },
    ));
    this.cell = {
      x: spriteX + spritesheetTexture.pieceOffsetX,
      y: spriteY + spritesheetTexture.pieceOffsetY,
    };
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

    // Position of the point relative to the spritesheet texture
    const spritesheetX = this.texture.frame.x + spriteX;
    const spritesheetY = this.texture.frame.y + spriteY;

    // Convert position to index, because alphaData is a 1D array representation of the spritesheet's alpha channel
    const pixelIndex = this.spritesheetTexture.source.width * spritesheetY + spritesheetX;
    return this.spritesheetTexture.alphaData[pixelIndex] < this.transparentThreshold;
  }

}

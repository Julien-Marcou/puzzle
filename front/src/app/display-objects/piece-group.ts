import type { PieceSprite } from './piece-sprite';
import type { Point } from '../models/geometry';

import { OutlineFilter } from 'pixi-filters';
import { Container } from 'pixi.js';

export class PieceGroup extends Container<PieceSprite> {

  private locked = false;

  public hitBy(point: Point): boolean {
    if (this.isLocked()) {
      return false;
    }
    const relativePoint = {
      x: point.x - this.x,
      y: point.y - this.y,
    };
    for (const pieceSprite of this.children) {
      if (pieceSprite.isPointInBoundingBox(relativePoint) && !pieceSprite.isPixelTransparentAt(relativePoint)) {
        return true;
      }
    }
    return false;
  }

  public mergeWith(pieceGroup: PieceGroup): void {
    const pieces = this.removeChildren();
    const offsetX = this.x - pieceGroup.x;
    const offsetY = this.y - pieceGroup.y;
    pieces.forEach((piece) => {
      piece.x += offsetX;
      piece.y += offsetY;
      pieceGroup.addChild(piece);
    });
  }

  public addOutline(): void {
    this.filters = [
      new OutlineFilter({
        thickness: 2,
        color: 0x000000,
        quality: 0.4,
      }),
      new OutlineFilter({
        thickness: 2,
        color: 0xffffff,
        quality: 0.4,
      }),
    ];
  }

  public removeOutline(): void {
    this.filters = [];
  }

  public lock(): void {
    this.locked = true;
  }

  public isLocked(): boolean {
    return this.locked;
  }

}

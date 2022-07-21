// import { OutlineFilter } from '@pixi/filter-outline';
import { Container } from 'pixi.js';
import type { Point } from '../models/geometry';
import type { PieceSprite } from './piece-sprite';

export class PieceGroup extends Container {

  private locked = false;

  public hitBy(point: Point): boolean {
    if (this.isLocked()) {
      return false;
    }
    const relativePoint = {
      x: point.x - this.x,
      y: point.y - this.y,
    };
    for (const pieceSprite of (this.children as Array<PieceSprite>)) {
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
    if (!this.filters) {
      this.filters = [
        // new OutlineFilter(2, 0x000000, 0.1),
        // new OutlineFilter(2, 0xffffff, 0.1),
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

  public lock(): void {
    this.locked = true;
  }

  public isLocked(): boolean {
    return this.locked;
  }

}

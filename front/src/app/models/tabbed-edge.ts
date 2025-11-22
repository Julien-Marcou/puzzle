import type { Edge } from './edge';
import type { BezierPath } from './geometry';

import { Axis } from './geometry';
import { PieceShape } from './piece-shape';
import { Canvas } from '../services/canvas';
import { Geometry } from '../services/geometry';

export class TabbedEdge implements Edge {

  private paths: BezierPath[];

  constructor(axis: Axis, private readonly addVariance = true) {
    this.paths = this.getPaths();
    this.applyRandomTabDirection();
    if (axis === Axis.Vertical) {
      for (const path of this.paths) {
        Geometry.invertBezierPathAxis(path);
      }
    }
  }

  public appendTo(context: CanvasPath, x: number, y: number, size: number, invertEdge: boolean): void {
    if (invertEdge) {
      this.paths.reverse();
    }
    for (const path of this.paths) {
      Canvas.drawBezierPath(path, context, x, y, size, invertEdge);
    }
    if (invertEdge) {
      this.paths.reverse();
    }
  }

  private getPaths(): BezierPath[] {
    // Build the path horizontaly then invert the axis if needed
    const tabCenterX = 50 + this.getRandomVariance(-PieceShape.Parameters.tabCenteringVariance, PieceShape.Parameters.tabCenteringVariance);
    const tabTopY = -PieceShape.Parameters.tabOverflow + this.getRandomVariance(-PieceShape.Parameters.tabOverflowVariance, PieceShape.Parameters.tabRecessVariance);
    const neckLeftX = tabCenterX - PieceShape.Parameters.tabWidth / 2;
    const neckRightX = tabCenterX + PieceShape.Parameters.tabWidth / 2;
    const neckTopY = tabTopY + PieceShape.Parameters.tabOverflow / 2;
    const neckBottomY = tabTopY + PieceShape.Parameters.tabOverflow + PieceShape.Parameters.tabRecess;

    return [
      // Left shoulder
      {
        start: {
          x: 0,
          y: 0,
          dx: PieceShape.Parameters.shoulderVectorLength + this.getRandomVariance(-PieceShape.Parameters.shoulderVariance, PieceShape.Parameters.shoulderVariance),
          dy: 0,
        },
        end: {
          x: neckLeftX,
          y: neckBottomY,
          dx: neckLeftX - PieceShape.Parameters.tabVectorLength,
          dy: neckBottomY + PieceShape.Parameters.tabVectorLength,
        },
      },
      // Left neck
      {
        start: {
          x: neckLeftX,
          y: neckBottomY,
          dx: neckLeftX + PieceShape.Parameters.tabVectorLength,
          dy: neckBottomY - PieceShape.Parameters.tabVectorLength,
        },
        end: {
          x: neckLeftX,
          y: neckTopY,
          dx: neckLeftX + PieceShape.Parameters.tabVectorLength,
          dy: neckTopY + PieceShape.Parameters.tabVectorLength,
        },
      },
      // Left head
      {
        start: {
          x: neckLeftX,
          y: neckTopY,
          dx: neckLeftX - PieceShape.Parameters.tabVectorLength,
          dy: neckTopY - PieceShape.Parameters.tabVectorLength,
        },
        end: {
          x: tabCenterX,
          y: tabTopY,
          dx: tabCenterX - PieceShape.Parameters.tabVectorLength,
          dy: tabTopY,
        },
      },
      // Right head
      {
        start: {
          x: tabCenterX,
          y: tabTopY,
          dx: tabCenterX + PieceShape.Parameters.tabVectorLength,
          dy: tabTopY,
        },
        end: {
          x: neckRightX,
          y: neckTopY,
          dx: neckRightX + PieceShape.Parameters.tabVectorLength,
          dy: neckTopY - PieceShape.Parameters.tabVectorLength,
        },
      },
      // Right neck
      {
        start: {
          x: neckRightX,
          y: neckTopY,
          dx: neckRightX - PieceShape.Parameters.tabVectorLength,
          dy: neckTopY + PieceShape.Parameters.tabVectorLength,
        },
        end: {
          x: neckRightX,
          y: neckBottomY,
          dx: neckRightX - PieceShape.Parameters.tabVectorLength,
          dy: neckBottomY - PieceShape.Parameters.tabVectorLength,
        },
      },
      // Right shoulder
      {
        start: {
          x: neckRightX,
          y: neckBottomY,
          dx: neckRightX + PieceShape.Parameters.tabVectorLength,
          dy: neckBottomY + PieceShape.Parameters.tabVectorLength,
        },
        end: {
          x: 100,
          y: 0,
          dx: 100 - PieceShape.Parameters.shoulderVectorLength + this.getRandomVariance(-PieceShape.Parameters.shoulderVariance, PieceShape.Parameters.shoulderVariance),
          dy: 0,
        },
      },
    ];
  }

  private getRandomVariance(minVariance: number, maxVariance: number): number {
    if (!this.addVariance) {
      return 0;
    }
    return minVariance + Math.random() * (maxVariance - minVariance);
  }

  private getRandomTabDirection(): -1 | 1 {
    if (!this.addVariance) {
      return -1;
    }
    return Math.random() < 0.5 ? -1 : 1;
  }

  private applyRandomTabDirection(): void {
    const tabDirection = this.getRandomTabDirection();
    for (const path of this.paths) {
      path.start.y *= tabDirection;
      path.start.dy *= tabDirection;
      path.end.y *= tabDirection;
      path.end.dy *= tabDirection;
    }
  }

}

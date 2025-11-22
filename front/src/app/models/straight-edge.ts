import type { Edge } from './edge';
import type { StraightPath } from './geometry';

import { Axis } from './geometry';
import { Canvas } from '../services/canvas';
import { Geometry } from '../services/geometry';

export class StraightEdge implements Edge {

  private path: StraightPath;

  constructor(axis: Axis) {
    this.path = this.getPath();
    if (axis === Axis.Vertical) {
      Geometry.invertStraightPathAxis(this.path);
    }
  }

  public appendTo(context: CanvasPath, x: number, y: number, size: number, invertEdge: boolean): void {
    Canvas.drawStraightPath(this.path, context, x, y, size, invertEdge);
  }

  private getPath(): StraightPath {
    // Build the path horizontaly then invert the axis if needed
    return {
      start: {
        x: 0,
        y: 0,
      },
      end: {
        x: 100,
        y: 0,
      },
    };
  }

}

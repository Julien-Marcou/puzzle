import { Edge } from '../models/edge';
import type { BezierPath, StraightPath } from '../models/geometry';

type Repetition = 'repeat' | 'repeat-x' | 'repeat-y' | 'no-repeat';

export class Canvas {

  public static getContext2D(canvas: HTMLCanvasElement, options?: CanvasRenderingContext2DSettings): CanvasRenderingContext2D {
    const context = canvas.getContext('2d', options);
    if (!context) {
      throw new Error('Could not get the 2D context from the canvas');
    }
    return context;
  }

  public static createPattern(context: CanvasRenderingContext2D, image: CanvasImageSource, repetition: Repetition = 'repeat'): CanvasPattern {
    const pattern = context.createPattern(image, repetition);
    if (!pattern) {
      throw new Error('Could not create the pattern from the source image');
    }
    return pattern;
  }

  public static drawStraightPath(path: StraightPath, context: CanvasPath, x: number, y: number, size: number, invertPath: boolean): void {
    const start = invertPath ? path.end : path.start;
    const end = invertPath ? path.start : path.end;
    context.lineTo(start.x / 100 * size + x, start.y / 100 * size + y);
    context.lineTo(end.x / 100 * size + x, end.y / 100 * size + y);
  }

  public static drawBezierPath(path: BezierPath, context: CanvasPath, x: number, y: number, size: number, invertPath: boolean): void {
    const start = invertPath ? path.end : path.start;
    const end = invertPath ? path.start : path.end;
    context.lineTo(start.x / 100 * size + x, start.y / 100 * size + y);
    context.bezierCurveTo(
      start.dx / 100 * size + x, start.dy / 100 * size + y,
      end.dx / 100 * size + x, end.dy / 100 * size + y,
      end.x / 100 * size + x, end.y / 100 * size + y,
    );
  }

  public static getEdgeAsPath2D(edge: Edge, x: number, y: number, size: number, invertEdge: boolean): Path2D {
    const path = new Path2D();
    path.moveTo(x, y);
    edge.appendTo(path, x, y, size, invertEdge);
    return path;
  }

}

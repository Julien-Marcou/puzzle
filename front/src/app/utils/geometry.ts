import type { BezierPath, Point, StraightPath, Vector } from '../models/geometry';

export class Geometry {

  public static invertPointAxis(point: Point): void {
    const x = point.x;
    point.x = point.y;
    point.y = x;
  }

  public static invertVectorAxis(vector: Vector): void {
    const dx = vector.dx;
    vector.dx = vector.dy;
    vector.dy = dx;
  }

  public static invertStraightPathAxis(path: StraightPath): void {
    this.invertPointAxis(path.start);
    this.invertPointAxis(path.end);
  }

  public static invertBezierPathAxis(path: BezierPath): void {
    this.invertPointAxis(path.start);
    this.invertVectorAxis(path.start);
    this.invertPointAxis(path.end);
    this.invertVectorAxis(path.end);
  }

}

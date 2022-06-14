export const enum Axis {
  Horizontal = 'horizontal',
  Vertical = 'vertical',
}

export const enum Dimension {
  Width = 'width',
  Height = 'height',
}

export const VALID_AXES = [
  Axis.Horizontal,
  Axis.Vertical,
] as const;

export const AXIS_TO_DIMENSION = {
  [Axis.Horizontal]: Dimension.Width,
  [Axis.Vertical]: Dimension.Height,
} as const;

export type Point = {x: number; y: number};

export type Vector = {dx: number; dy: number};

export type Size = {width: number; height: number};

export type StraightPath = {
  start: Point;
  end: Point;
};

export type BezierPath = {
  start: Point & Vector;
  end: Point & Vector;
};

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

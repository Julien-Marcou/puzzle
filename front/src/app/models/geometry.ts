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

export type Point = { x: number; y: number };

export type Vector = { dx: number; dy: number };

export type Size = { width: number; height: number };

export type StraightPath = {
  start: Point;
  end: Point;
};

export type BezierPath = {
  start: Point & Vector;
  end: Point & Vector;
};

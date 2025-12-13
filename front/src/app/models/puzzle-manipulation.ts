import type { Point } from './geometry';
import type { PieceGroup } from '../display-objects/piece-group';

export type GroupSnapping = {
  pieceGroup: PieceGroup;
  snapPosition: Point;
};

export type PointerId = number;

export type Pointer = {
  id: PointerId;
  origin: Point;
  position: Point;
  timestamp: number;
};

export type PinchToZoomInitialState = {
  pinchOrigin: Point;
  meanDistance: number;
  viewportOrigin: Point;
  viewportScale: number;
  pointerCount: number;
};

export type ViewportDragInitialState = {
  dragOrigin: Point;
  viewportOrigin: Point;
};

export type PieceGroupDragInitialState = {
  pieceGroup: PieceGroup;
  dragOrigin: Point;
  pieceOrigin: Point;
};

export const enum ViewportState {
  Manipulation = 'manipulation',
  Interaction = 'interaction',
  Idle = 'idle',
}

export const enum ManipulationType {
  Pan = 'pan',
  Pinch = 'pinch',
}

export type PuzzleEventListeners = {
  pointerdown: (event: PointerEvent) => void;
  pointerup: (event: PointerEvent) => void;
  pointercancel: (event: PointerEvent) => void;
  pointermove: (event: PointerEvent) => void;
  pointerleave: (event: PointerEvent) => void;
  wheel: (event: WheelEvent) => void;
};

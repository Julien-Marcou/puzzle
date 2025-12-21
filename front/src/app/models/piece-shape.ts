import type { Edge } from './edge';

export class PieceShape {

  public static readonly Parameters = {
    shoulderVectorLength: 20,
    shoulderVariance: 9,
    tabWidth: 20,
    tabOverflow: 20,
    tabRecess: 5,
    tabVectorLength: 5,
    tabCenteringVariance: 11,
    tabOverflowVariance: 8,
    tabRecessVariance: 2,
    strokeColor: '#fff',
    strokeThickness: 2,
  };

  public static readonly MarginFactor = (this.Parameters.tabOverflow + this.Parameters.tabOverflowVariance + 1) / 100;

  public readonly path: Path2D;

  constructor(
    size: number,
    northEdge: Edge,
    eastEdge: Edge,
    southEdge: Edge,
    westEdge: Edge,
    pieceMargin: number,
  ) {
    this.path = this.buildPath(size, northEdge, eastEdge, southEdge, westEdge, pieceMargin);
  }

  private buildPath(size: number, northEdge: Edge, eastEdge: Edge, southEdge: Edge, westEdge: Edge, pieceMargin: number): Path2D {
    const start = pieceMargin;
    const end = size + pieceMargin;

    const path = new Path2D();
    path.moveTo(start, start);
    northEdge.appendTo(path, start, start, size, false);
    eastEdge.appendTo(path, end, start, size, false);
    southEdge.appendTo(path, start, end, size, true);
    westEdge.appendTo(path, start, start, size, true);
    path.closePath();

    return path;
  }

}

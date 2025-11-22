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
  };

  public static readonly MarginFactor = (this.Parameters.tabOverflow + this.Parameters.tabOverflowVariance + 1) / 100;

  public readonly path: Path2D;

  constructor(
    public readonly x: number,
    public readonly y: number,
    private readonly size: number,
    private readonly northEdge: Edge,
    private readonly eastEdge: Edge,
    private readonly southEdge: Edge,
    private readonly westEdge: Edge,
  ) {
    this.path = this.buildPath();
  }

  private buildPath(): Path2D {
    const path = new Path2D();
    path.moveTo(0, 0);
    this.northEdge.appendTo(path, 0, 0, this.size, false);
    this.eastEdge.appendTo(path, this.size, 0, this.size, false);
    this.southEdge.appendTo(path, 0, this.size, this.size, true);
    this.westEdge.appendTo(path, 0, 0, this.size, true);
    path.closePath();
    return path;
  }

}

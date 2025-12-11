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
    strokeThickness: 1,
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
    pathOffset: number,
  ) {
    this.path = this.buildPath(pathOffset);
  }

  private buildPath(pathOffset: number): Path2D {
    const start = pathOffset;
    const end = this.size + pathOffset;

    const path = new Path2D();
    path.moveTo(start, start);
    this.northEdge.appendTo(path, start, start, this.size, false);
    this.eastEdge.appendTo(path, end, start, this.size, false);
    this.southEdge.appendTo(path, start, end, this.size, true);
    this.westEdge.appendTo(path, start, start, this.size, true);
    path.closePath();

    return path;
  }

}

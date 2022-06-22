import { Canvas } from '../services/canvas';
import { Edge } from './edge';
import { Axis, Point, VALID_AXES } from './geometry';
import { TabbedEdge } from './tabbed-edge';

export class PuzzlePreview {

  private readonly puzzleMaxWidth = 2152;
  private readonly scale;

  private readonly pieceStrokeLightColor = '#fff';
  private readonly pieceStrokeShadowColor = '#000';
  private readonly defaultPieceStrokeThickness = 2;
  private readonly pieceStrokeThickness;
  private readonly puzzleOverflowFillColor = '#fffc';

  private readonly imageWidth: number;
  private readonly imageHeight: number;
  private readonly puzzleWidth: number;
  private readonly puzzleHeight: number;
  private readonly context: CanvasRenderingContext2D;
  private readonly middlePatternCanvas: HTMLCanvasElement;
  private readonly horizontalPatternCanvas: HTMLCanvasElement;
  private readonly verticalPatternCanvas: HTMLCanvasElement;
  private readonly middlePatternContext: CanvasRenderingContext2D;
  private readonly horizontalPatternContext: CanvasRenderingContext2D;
  private readonly verticalPatternContext: CanvasRenderingContext2D;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly image: ImageBitmap,
    private readonly imageOffset: Point = {x: 0, y: 0},
    private readonly pieceSize: number,
    private readonly horizontalPieceCount: number,
    private readonly verticalPieceCount: number,
  ) {
    // Scale down the inputs
    const pixelDensity = Math.min(Math.max(window.devicePixelRatio, 1), 2);
    const puzzleMaxWidth = Math.min(this.puzzleMaxWidth, this.canvas.clientWidth * pixelDensity);
    this.scale = this.image.width > puzzleMaxWidth ? puzzleMaxWidth / this.image.width : 1;
    this.imageOffset = {
      x: Math.round(this.imageOffset.x * this.scale),
      y: Math.round(this.imageOffset.y * this.scale),
    };
    this.pieceSize = Math.round(this.pieceSize * this.scale);
    this.imageWidth = this.pieceSize * this.horizontalPieceCount+ this.imageOffset.x * 2;
    this.imageHeight = this.pieceSize * this.verticalPieceCount + this.imageOffset.y * 2;
    const strokeScale = this.imageWidth > this.canvas.clientWidth ? this.imageWidth / this.canvas.clientWidth : 1;
    this.pieceStrokeThickness = this.defaultPieceStrokeThickness * strokeScale;

    this.puzzleWidth = this.pieceSize * this.horizontalPieceCount;
    this.puzzleHeight = this.pieceSize * this.verticalPieceCount;
    this.canvas.width = this.imageWidth;
    this.canvas.height = this.imageHeight;
    this.context = Canvas.getContext2D(this.canvas);

    this.horizontalPatternCanvas = document.createElement('canvas');
    this.verticalPatternCanvas = document.createElement('canvas');
    this.middlePatternCanvas = document.createElement('canvas');
    this.horizontalPatternCanvas.width = this.pieceSize;
    this.horizontalPatternCanvas.height = this.pieceSize;
    this.verticalPatternCanvas.width = this.pieceSize;
    this.verticalPatternCanvas.height = this.pieceSize;
    this.middlePatternCanvas.width = this.pieceSize;
    this.middlePatternCanvas.height = this.pieceSize;
    this.horizontalPatternContext = Canvas.getContext2D(this.horizontalPatternCanvas);
    this.verticalPatternContext = Canvas.getContext2D(this.verticalPatternCanvas);
    this.middlePatternContext = Canvas.getContext2D(this.middlePatternCanvas);

    this.drawPatterns();
    this.draw();
  }

  private draw(): void {
    const patterns = this.getPatterns();

    // Draw background
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.context.drawImage(
      this.image,
      0, 0, this.image.width, this.image.height,
      0, 0, this.imageWidth, this.imageHeight,
    );

    // Draw overflow overlay
    const overflowX = this.imageOffset.x + this.puzzleWidth;
    const overflowY = this.imageOffset.y + this.puzzleHeight;
    const overflowWidth = this.canvas.width - overflowX;
    const overflowHeight = this.canvas.height - overflowY;
    this.context.save();
    this.context.fillStyle = this.puzzleOverflowFillColor;
    this.context.fillRect(0, 0, this.imageOffset.x, this.canvas.height);
    this.context.fillRect(overflowX, 0, overflowWidth, this.canvas.height);
    this.context.fillRect(this.imageOffset.x, 0, this.puzzleWidth, this.imageOffset.y);
    this.context.fillRect(this.imageOffset.x, overflowY, this.puzzleWidth, overflowHeight);
    this.context.restore();

    // Draw shadow outline
    const halfStrokeThickness = this.pieceStrokeThickness / 2;
    const halfStrokeThicknessFloor = (halfStrokeThickness);
    const halfStrokeThicknessCeil = (halfStrokeThickness);
    this.context.save();
    this.context.lineWidth = halfStrokeThicknessCeil;
    this.context.strokeStyle = this.pieceStrokeShadowColor;
    this.context.strokeRect(
      this.imageOffset.x,
      this.imageOffset.y,
      this.puzzleWidth - halfStrokeThicknessFloor,
      this.puzzleHeight - halfStrokeThicknessFloor,
    );
    this.context.restore();

    // Draw middle section of the puzzle cutouts
    const middle = Math.round(this.pieceSize / 2);
    this.context.save();
    this.context.fillStyle = patterns.middle;
    this.context.fillRect(
      this.imageOffset.x + middle,
      this.imageOffset.y + middle,
      this.pieceSize * (this.horizontalPieceCount - 1),
      this.pieceSize * (this.verticalPieceCount - 1),
    );
    // Draw top section of the puzzle cutouts
    this.context.fillStyle = patterns.vertical;
    this.context.fillRect(
      this.imageOffset.x + middle,
      this.imageOffset.y,
      this.pieceSize * (this.horizontalPieceCount - 1),
      middle,
    );
    // Draw bottom section of the puzzle cutouts
    this.context.fillRect(
      this.imageOffset.x + middle,
      this.imageOffset.y + middle + this.pieceSize * (this.verticalPieceCount - 1),
      this.pieceSize * (this.horizontalPieceCount - 1),
      middle,
    );
    // Draw left section of the puzzle cutouts
    this.context.fillStyle = patterns.horizontal;
    this.context.fillRect(
      this.imageOffset.x,
      this.imageOffset.y + middle,
      middle,
      this.pieceSize * (this.verticalPieceCount - 1),
    );
    // Draw right section of the puzzle cutouts
    this.context.fillRect(
      this.imageOffset.x + middle + this.pieceSize * (this.horizontalPieceCount - 1),
      this.imageOffset.y + middle,
      middle,
      this.pieceSize * (this.verticalPieceCount - 1),
    );
    this.context.restore();

    // Draw light outline
    this.context.save();
    this.context.lineWidth = halfStrokeThicknessCeil;
    this.context.strokeStyle = this.pieceStrokeShadowColor;
    this.context.beginPath();
    this.context.moveTo(this.imageOffset.x + this.puzzleWidth - halfStrokeThicknessCeil, this.imageOffset.y);
    this.context.lineTo(this.imageOffset.x, this.imageOffset.y);
    this.context.lineTo(this.imageOffset.x, this.imageOffset.y + this.puzzleHeight - halfStrokeThicknessCeil);
    this.context.stroke();
    this.context.strokeStyle = this.pieceStrokeLightColor;
    this.context.strokeRect(
      this.imageOffset.x + halfStrokeThicknessCeil,
      this.imageOffset.y + halfStrokeThicknessCeil,
      this.puzzleWidth - halfStrokeThicknessFloor,
      this.puzzleHeight - halfStrokeThicknessFloor,
    );
    this.context.restore();
  }

  private drawPatterns(): void {
    this.horizontalPatternContext.clearRect(0, 0, this.horizontalPatternCanvas.width, this.horizontalPatternCanvas.height);
    this.verticalPatternContext.clearRect(0, 0, this.verticalPatternCanvas.width, this.verticalPatternCanvas.height);
    this.middlePatternContext.clearRect(0, 0, this.middlePatternCanvas.width, this.middlePatternCanvas.height);

    const middle = Math.round(this.pieceSize / 2);
    const edges: Record<Axis, Edge> = {
      [Axis.Horizontal]: new TabbedEdge(Axis.Horizontal, false),
      [Axis.Vertical]: new TabbedEdge(Axis.Vertical, false),
    };
    const middleOffsets: Record<Axis, Point> = {
      [Axis.Horizontal]: {
        x: this.pieceSize,
        y: 0,
      },
      [Axis.Vertical]: {
        x: 0,
        y: this.pieceSize,
      },
    };
    const halfStrokeThickness = this.pieceStrokeThickness / 2;
    const halfStrokeThicknessFloor = (halfStrokeThickness);
    const halfStrokeThicknessCeil = (halfStrokeThickness);
    const layers = [
      {
        strokeColor: this.pieceStrokeShadowColor,
        strokeThickness: halfStrokeThicknessCeil,
        offset: {
          x: -halfStrokeThicknessFloor,
          y: -halfStrokeThicknessFloor,
        },
      },
      {
        strokeColor: this.pieceStrokeLightColor,
        strokeThickness: halfStrokeThicknessCeil,
        offset: {
          x: 0,
          y: 0,
        },
      },
    ];

    // Build the texture of the joining of the edges
    const middleContext = this.middlePatternContext;
    for (const layer of layers) {
      middleContext.save();
      middleContext.strokeStyle = layer.strokeColor;
      middleContext.lineWidth = layer.strokeThickness;
      for (const axis of VALID_AXES) {
        const edge = edges[axis];
        const middleOffset = middleOffsets[axis];
        for (const direction of [-1, 0]) {
          const horizontalOffset = middle + (middleOffset.x * direction) + layer.offset.x;
          const verticalOffset = middle + (middleOffset.y * direction) + layer.offset.y;
          middleContext.moveTo(horizontalOffset, verticalOffset);
          middleContext.beginPath();
          edge.appendTo(middleContext, horizontalOffset, verticalOffset, this.pieceSize, false);
          middleContext.stroke();
        }
      }
      middleContext.restore();
    }

    // Build the texture of the distinct edges
    for (const axis of VALID_AXES) {
      const context = axis === Axis.Horizontal ? this.horizontalPatternContext : this.verticalPatternContext;
      const edge = edges[axis];
      const middleOffset = middleOffsets[axis];
      context.save();
      context.beginPath();
      for (const layer of layers) {
        context.save();
        context.strokeStyle = layer.strokeColor;
        context.lineWidth = layer.strokeThickness;
        for (const direction of [-1, 0]) {
          const horizontalOffset = middle + (middleOffset.x * direction) + layer.offset.x;
          const verticalOffset = middle + (middleOffset.y * direction) + layer.offset.y;
          context.moveTo(horizontalOffset, verticalOffset);
          context.beginPath();
          edge.appendTo(context, horizontalOffset, verticalOffset, this.pieceSize, false);
          context.stroke();
        }
        context.restore();
      }
      context.restore();
    }
  }

  private getPatterns(): Record<'horizontal'|'vertical'|'middle', CanvasPattern> {
    const middle = Math.round(this.pieceSize / 2);

    // Horizontal pattern
    const horizontalPatternMatrix = new DOMMatrix().translate(
      this.imageOffset.x + middle,
      this.imageOffset.y + middle,
    );
    const horizontalPattern = Canvas.createPattern(this.horizontalPatternContext, this.horizontalPatternCanvas);
    horizontalPattern.setTransform(horizontalPatternMatrix);

    // Vertical pattern
    const verticalPatternMatrix = new DOMMatrix().translate(
      this.imageOffset.x + middle,
      this.imageOffset.y + middle,
    );
    const verticalPattern = Canvas.createPattern(this.verticalPatternContext, this.verticalPatternCanvas);
    verticalPattern.setTransform(verticalPatternMatrix);

    // Middle pattern
    const middlePatternMatrix = new DOMMatrix().translate(
      this.imageOffset.x + middle,
      this.imageOffset.y + middle,
    );
    const middlePattern = Canvas.createPattern(this.middlePatternContext, this.middlePatternCanvas);
    middlePattern.setTransform(middlePatternMatrix);

    return {
      horizontal: horizontalPattern,
      vertical: verticalPattern,
      middle: middlePattern,
    };
  }

}

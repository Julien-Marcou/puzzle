import type { Edge } from '../models/edge';
import type { PuzzleSpritesheetParameters } from '../models/puzzle-parameters';
import type { PuzzleSpritesheet } from '../models/puzzle-spritesheet';

import { Canvas } from './canvas';
import { Axis } from '../models/geometry';
import { PieceShape } from '../models/piece-shape';
import { StraightEdge } from '../models/straight-edge';
import { TabbedEdge } from '../models/tabbed-edge';

addEventListener('message', ({ data }: MessageEvent<PuzzleSpritesheetParameters>): void => {
  const spritesheetWorker = new PuzzleSpritesheetWorker(data);
  const spritesheet = spritesheetWorker.build();
  postMessage(spritesheet, { transfer: [spritesheet.image, spritesheet.alphaData.buffer] });
});

export class PuzzleSpritesheetWorker {

  private readonly edgeMatrices: Record<Axis, Edge[][]>;
  private readonly pieceShapeMatrix: PieceShape[][];

  constructor(
    private readonly parameters: PuzzleSpritesheetParameters,
  ) {
    this.edgeMatrices = {
      [Axis.Horizontal]: this.buildEdgeMatrix(Axis.Horizontal),
      [Axis.Vertical]: this.buildEdgeMatrix(Axis.Vertical),
    };
    this.pieceShapeMatrix = this.buildPieceShapeMatrix();
  }

  private buildEdgeMatrix(edgeAxis: Axis): Edge[][] {
    // There is one more edge when adding them along their opposite axis
    // e.g. when edges are verticals, if there is 10 pieces, then there is 11 vertical edges along the horizontal axis
    const edgeCountX = this.parameters.horizontalPieceCount + (edgeAxis === Axis.Vertical ? 1 : 0);
    const edgeCountY = this.parameters.verticalPieceCount + (edgeAxis === Axis.Horizontal ? 1 : 0);
    const edgeMatrice = [];
    for (let x = 0; x < edgeCountX; x++) {
      const edgeList = [];
      for (let y = 0; y < edgeCountY; y++) {
        if (
          (edgeAxis === Axis.Vertical && (x === 0 || x === this.parameters.horizontalPieceCount))
          || (edgeAxis === Axis.Horizontal && (y === 0 || y === this.parameters.verticalPieceCount))
        ) {
          edgeList.push(new StraightEdge(edgeAxis));
        }
        else {
          edgeList.push(new TabbedEdge(edgeAxis));
        }
      }
      edgeMatrice.push(edgeList);
    }
    return edgeMatrice;
  }

  private buildPieceShapeMatrix(): PieceShape[][] {
    const pieceShapeMatrix = [];
    for (let x = 0; x < this.parameters.horizontalPieceCount; x++) {
      const pieceShapeList = [];
      for (let y = 0; y < this.parameters.verticalPieceCount; y++) {
        pieceShapeList.push(new PieceShape(
          x * this.parameters.pieceSize,
          y * this.parameters.pieceSize,
          this.parameters.pieceSize,
          this.edgeMatrices.horizontal[x][y],
          this.edgeMatrices.vertical[x + 1][y],
          this.edgeMatrices.horizontal[x][y + 1],
          this.edgeMatrices.vertical[x][y],
          this.parameters.pieceMargin,
        ));
      }
      pieceShapeMatrix.push(pieceShapeList);
    }
    return pieceShapeMatrix;
  }

  public build(): PuzzleSpritesheet {
    const spritesheetWidth = this.parameters.pieceSpriteSize * this.parameters.horizontalPieceCount;
    const spritesheetHeight = this.parameters.pieceSpriteSize * this.parameters.verticalPieceCount;

    const spritesheetCanvas = new OffscreenCanvas(spritesheetWidth, spritesheetHeight);
    const spritesheetContext = Canvas.getOffscreenContext2D(spritesheetCanvas);

    // Build sprite for each pieces
    const spriteCanvas = new OffscreenCanvas(this.parameters.pieceSpriteSize, this.parameters.pieceSpriteSize);
    const spriteContext = Canvas.getOffscreenContext2D(spriteCanvas);

    for (let x = 0; x < this.parameters.horizontalPieceCount; x++) {
      for (let y = 0; y < this.parameters.verticalPieceCount; y++) {
        const pieceShape = this.pieceShapeMatrix[x][y];

        spriteContext.reset();

        // Outline for better "piece to piece" fit
        spriteContext.strokeStyle = PieceShape.Parameters.strokeColor;
        spriteContext.lineWidth = PieceShape.Parameters.strokeThickness;
        spriteContext.stroke(pieceShape.path);

        // Crop piece image
        const { sx, sy, sw, sh, dx, dy, dw, dh } = this.getPieceCropValues(x, y, pieceShape.x, pieceShape.y);
        spriteContext.clip(pieceShape.path);
        spriteContext.drawImage(this.parameters.puzzleImage, sx, sy, sw, sh, dx, dy, dw, dh);
        spritesheetContext.drawImage(spriteCanvas, x * this.parameters.pieceSpriteSize, y * this.parameters.pieceSpriteSize);
      }
    }

    // Close original image as we no longer need it, to save some memory
    this.parameters.puzzleImage.close();

    // Order matters, transferToImageBitamp() will clear the canvas, so getImageData() would no longer work after it
    const rgbaData = spritesheetContext.getImageData(0, 0, spritesheetWidth, spritesheetHeight).data;
    const image = spritesheetCanvas.transferToImageBitmap();

    // Build alpha channel for each pixels
    const bytePerPixel = 4;
    const alphaChannelOffset = 3;
    const alphaData = new Uint8ClampedArray(rgbaData.byteLength / bytePerPixel);
    let pixelIndex = 0;
    for (let alphaIndex = alphaChannelOffset; alphaIndex < rgbaData.byteLength; alphaIndex += bytePerPixel) {
      alphaData.fill(rgbaData[alphaIndex], pixelIndex, ++pixelIndex);
    }

    return { image, alphaData };
  }

  private getPieceCropValues(x: number, y: number, originX: number, originY: number): { sx: number; sy: number; sw: number; sh: number; dx: number; dy: number; dw: number; dh: number } {
    let sourceX = originX - this.parameters.pieceMargin + this.parameters.puzzleOffset.x;
    let sourceY = originY - this.parameters.pieceMargin + this.parameters.puzzleOffset.y;
    let sourceWidth = this.parameters.pieceSpriteSize;
    let sourceHeight = this.parameters.pieceSpriteSize;

    let destinationX = 0;
    let destinationY = 0;
    let destinationWidth = this.parameters.pieceSpriteSize;
    let destinationHeight = this.parameters.pieceSpriteSize;

    // Outer pieces of the puzzle don't need margin as they have no tab to connect to other pieces
    // Also, cropping outside of the source image on iOS will make the drawImage() fail
    // So we make sure to not have negative values for these outer pieces
    if (x === 0) {
      sourceX += this.parameters.pieceMargin;
      destinationX += this.parameters.pieceMargin;
      sourceWidth -= this.parameters.pieceMargin;
      destinationWidth -= this.parameters.pieceMargin;
    }
    else if (x === this.parameters.horizontalPieceCount - 1) {
      sourceWidth -= this.parameters.pieceMargin;
      destinationWidth -= this.parameters.pieceMargin;
    }

    if (y === 0) {
      sourceY += this.parameters.pieceMargin;
      destinationY += this.parameters.pieceMargin;
      sourceHeight -= this.parameters.pieceMargin;
      destinationHeight -= this.parameters.pieceMargin;
    }
    else if (y === this.parameters.verticalPieceCount - 1) {
      sourceHeight -= this.parameters.pieceMargin;
      destinationHeight -= this.parameters.pieceMargin;
    }

    return {
      sx: sourceX,
      sy: sourceY,
      sw: sourceWidth,
      sh: sourceHeight,
      dx: destinationX,
      dy: destinationY,
      dw: destinationWidth,
      dh: destinationHeight,
    };
  }

}

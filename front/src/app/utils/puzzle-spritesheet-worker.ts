import type { Edge } from '../models/edge';
import type { PuzzleSpritesheetParameters } from '../models/puzzle-parameters';
import type { PuzzleSpritesheetImage } from '../models/puzzle-spritesheet';

import { Canvas } from './canvas';
import { Axis } from '../models/geometry';
import { PieceShape } from '../models/piece-shape';
import { StraightEdge } from '../models/straight-edge';
import { TabbedEdge } from '../models/tabbed-edge';

addEventListener('message', ({ data }: MessageEvent<PuzzleSpritesheetParameters>): void => {
  const spritesheetWorker = new PuzzleSpritesheetWorker(data);
  spritesheetWorker.build()
    .then((spritesheets) => {
      postMessage(
        spritesheets,
        {
          transfer: [
            ...spritesheets.map((spritesheet) => spritesheet.image),
            ...spritesheets.map((spritesheet) => spritesheet.alphaData.buffer),
          ],
        },
      );
    })
    .catch((error: unknown) => {
      console.error(error);
      postMessage(null);
    });
});

class PuzzleSpritesheetWorker {

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

  public async build(): Promise<PuzzleSpritesheetImage[]> {
    // We split the puzzle spritesheet into 4 quadrants to improve compatibility with older devices
    const horizontalQuadrantPieceCount = this.parameters.horizontalPieceCount / 2;
    const verticalQuadrantPieceCount = this.parameters.verticalPieceCount / 2;

    // Also, because splitting the puzzle into 4 identical quadrants is not always possible, we have to ceil/floor some of them
    // For example:
    // - a 11x9 pieces puzzle cannot be divided into 4 quadrants like:
    //   - 5.5x4.5 / 5.5x4.5
    //   - 5.5x4.5 / 5.5x4.5
    // - so instead we aim for:
    //   - 6x5 / 5x5
    //   - 6x4 / 5x4
    const leftQuadrantHorizontalPieceCount = Math.ceil(horizontalQuadrantPieceCount);
    const rightQuadrantHorizontalPieceCount = Math.floor(horizontalQuadrantPieceCount);

    const topQuadrantVerticalPieceCount = Math.ceil(verticalQuadrantPieceCount);
    const bottomQuadrantVerticalPieceCount = Math.floor(verticalQuadrantPieceCount);

    const topLeftSpritesheet = this.buildQuadrant(0, 0, leftQuadrantHorizontalPieceCount, topQuadrantVerticalPieceCount);
    const topRightSpritesheet = this.buildQuadrant(leftQuadrantHorizontalPieceCount, 0, rightQuadrantHorizontalPieceCount, topQuadrantVerticalPieceCount);
    const bottomLeftSpritesheet = this.buildQuadrant(0, topQuadrantVerticalPieceCount, leftQuadrantHorizontalPieceCount, bottomQuadrantVerticalPieceCount);
    const bottomRightSpritesheet = this.buildQuadrant(leftQuadrantHorizontalPieceCount, topQuadrantVerticalPieceCount, rightQuadrantHorizontalPieceCount, bottomQuadrantVerticalPieceCount);

    return await Promise.all([topLeftSpritesheet, topRightSpritesheet, bottomLeftSpritesheet, bottomRightSpritesheet]);
  }

  public async buildQuadrant(pieceOffsetX: number, pieceOffsetY: number, horizontalPieceCount: number, verticalPieceCount: number): Promise<PuzzleSpritesheetImage> {
    // Get puzzle quadrant image from source puzzle image
    const { x, y, w, h } = this.getQuadrantCropValues(pieceOffsetX, pieceOffsetY, horizontalPieceCount, verticalPieceCount);
    const quadrantImage = await createImageBitmap(this.parameters.puzzleImage, x, y, w, h);

    // Targeted canvas for current quadrant
    const spritesheetWidth = this.parameters.pieceSpriteSize * horizontalPieceCount;
    const spritesheetHeight = this.parameters.pieceSpriteSize * verticalPieceCount;
    const spritesheetCanvas = new OffscreenCanvas(spritesheetWidth, spritesheetHeight);
    const spritesheetContext = Canvas.getOffscreenContext2D(spritesheetCanvas);

    // Targeted canvas for current piece
    const spriteCanvas = new OffscreenCanvas(this.parameters.pieceSpriteSize, this.parameters.pieceSpriteSize);
    const spriteContext = Canvas.getOffscreenContext2D(spriteCanvas);

    // Build sprite for each pieces
    for (let pieceX = 0; pieceX < horizontalPieceCount; pieceX++) {
      for (let pieceY = 0; pieceY < verticalPieceCount; pieceY++) {
        const pieceShape = this.pieceShapeMatrix[pieceOffsetX + pieceX][pieceOffsetY + pieceY];

        spriteContext.reset();

        // Outline for better "piece to piece" fit
        spriteContext.strokeStyle = PieceShape.Parameters.strokeColor;
        spriteContext.lineWidth = PieceShape.Parameters.strokeThickness;
        spriteContext.stroke(pieceShape.path);

        // Crop piece image
        const { sx, sy, sw, sh, dx, dy, dw, dh } = this.getPieceCropValues(pieceOffsetX, pieceOffsetY, pieceX, pieceY);
        spriteContext.clip(pieceShape.path);
        spriteContext.drawImage(quadrantImage, sx, sy, sw, sh, dx, dy, dw, dh);
        spritesheetContext.drawImage(
          spriteCanvas,
          pieceX * this.parameters.pieceSpriteSize,
          pieceY * this.parameters.pieceSpriteSize,
          this.parameters.pieceSpriteSize,
          this.parameters.pieceSpriteSize,
        );
      }
    }

    // Build alpha channel for each pixels of the quadrant
    const bytePerPixel = 4;
    const alphaChannelOffset = 3;
    const rgbaData = spritesheetContext.getImageData(0, 0, spritesheetWidth, spritesheetHeight).data;
    const alphaData = new Uint8ClampedArray(rgbaData.byteLength / bytePerPixel);
    let pixelIndex = 0;
    for (let alphaIndex = alphaChannelOffset; alphaIndex < rgbaData.byteLength; alphaIndex += bytePerPixel) {
      alphaData[pixelIndex++] = rgbaData[alphaIndex];
    }

    const image = await createImageBitmap(spritesheetCanvas);
    return { image, alphaData, pieceOffsetX, pieceOffsetY, horizontalPieceCount, verticalPieceCount, spriteSize: this.parameters.pieceSpriteSize };
  }

  private getQuadrantCropValues(pieceOffsetX: number, pieceOffsetY: number, horizontalPieceCount: number, verticalPieceCount: number): { x: number; y: number; w: number; h: number } {
    return {
      x: this.parameters.puzzleOffset.x + pieceOffsetX * this.parameters.pieceSize - (pieceOffsetX === 0 ? 0 : this.parameters.pieceMargin),
      y: this.parameters.puzzleOffset.y + pieceOffsetY * this.parameters.pieceSize - (pieceOffsetY === 0 ? 0 : this.parameters.pieceMargin),
      w: horizontalPieceCount * this.parameters.pieceSize + this.parameters.pieceMargin,
      h: verticalPieceCount * this.parameters.pieceSize + this.parameters.pieceMargin,
    };
  }

  private getPieceCropValues(pieceOffsetX: number, pieceOffsetY: number, pieceX: number, pieceY: number): { sx: number; sy: number; sw: number; sh: number; dx: number; dy: number; dw: number; dh: number } {
    const cellX = pieceOffsetX + pieceX;
    const cellY = pieceOffsetY + pieceY;
    const isFirstHorizontalPiece = cellX === 0;
    const isLastHorizontalPiece = cellX === this.parameters.horizontalPieceCount - 1;
    const isFirstVerticalPiece = cellY === 0;
    const isLastVerticalPiece = cellY === this.parameters.verticalPieceCount - 1;

    // Outer pieces of the puzzle don't need outer margin as they have no outer tab to connect to other pieces
    // Also, cropping outside of the source image on iOS will make the drawImage() fail
    // So we make sure to not have negative values for these outer pieces
    const innerPieceSize = this.parameters.pieceSpriteSize;
    const outerPieceSize = this.parameters.pieceSpriteSize - this.parameters.pieceMargin;

    const sourceX = pieceX * this.parameters.pieceSize - (pieceOffsetX === 0 && pieceX > 0 ? this.parameters.pieceMargin : 0);
    const sourceY = pieceY * this.parameters.pieceSize - (pieceOffsetY === 0 && pieceY > 0 ? this.parameters.pieceMargin : 0);
    const sourceWidth = isFirstHorizontalPiece || isLastHorizontalPiece ? outerPieceSize : innerPieceSize;
    const sourceHeight = isFirstVerticalPiece || isLastVerticalPiece ? outerPieceSize : innerPieceSize;

    const destinationX = isFirstHorizontalPiece ? this.parameters.pieceMargin : 0;
    const destinationY = isFirstVerticalPiece ? this.parameters.pieceMargin : 0;
    const destinationWidth = sourceWidth;
    const destinationHeight = sourceHeight;

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

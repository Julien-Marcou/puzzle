import type { Edge } from './edge';
import type { PuzzleSpritesheet } from './puzzle-spritesheet';
import type { PuzzleSpritesheetParameters } from './puzzle-spritesheet-parameters';

import { Axis } from './geometry';
import { PieceShape } from './piece-shape';
import { StraightEdge } from './straight-edge';
import { TabbedEdge } from './tabbed-edge';
import { Canvas } from '../services/canvas';

export class PuzzleSpritesheetBuilder {

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

    // build sprite for each pieces
    const spriteCanvas = new OffscreenCanvas(this.parameters.pieceSpriteSize, this.parameters.pieceSpriteSize);
    const spriteContext = Canvas.getOffscreenContext2D(spriteCanvas);

    for (let x = 0; x < this.parameters.horizontalPieceCount; x++) {
      for (let y = 0; y < this.parameters.verticalPieceCount; y++) {
        const pieceShape = this.pieceShapeMatrix[x][y];

        spriteContext.reset();

        // outline for better "piece to piece" fit
        spriteContext.strokeStyle = PieceShape.Parameters.strokeColor;
        spriteContext.lineWidth = PieceShape.Parameters.strokeThickness;
        spriteContext.stroke(pieceShape.path);

        // build piece image
        spriteContext.clip(pieceShape.path);
        spriteContext.drawImage(
          this.parameters.image,
          -this.parameters.pieceMargin + pieceShape.x + this.parameters.imageOffset.x,
          -this.parameters.pieceMargin + pieceShape.y + this.parameters.imageOffset.y,
          this.parameters.pieceSpriteSize,
          this.parameters.pieceSpriteSize,
          0,
          0,
          this.parameters.pieceSpriteSize,
          this.parameters.pieceSpriteSize,
        );
        spritesheetContext.drawImage(spriteCanvas, x * this.parameters.pieceSpriteSize, y * this.parameters.pieceSpriteSize);
      }
    }

    // build piece alpha channels for each pieces
    const bytePerPixel = 4;
    const alphaChannelOffset = 3;
    const spritesheetPixels = spritesheetContext.getImageData(0, 0, spritesheetWidth, spritesheetHeight).data;

    const alphaChannels = Array.from(
      Array(this.parameters.horizontalPieceCount),
      () => Array.from(
        Array<Uint8ClampedArray[]>(this.parameters.verticalPieceCount),
        () => Array.from(
          Array(this.parameters.pieceSpriteSize),
          () => new Uint8ClampedArray(this.parameters.pieceSpriteSize),
        ),
      ),
    );

    for (let x = 0; x < this.parameters.horizontalPieceCount; x++) {
      for (let y = 0; y < this.parameters.verticalPieceCount; y++) {
        const spriteOriginX = x * this.parameters.pieceSpriteSize;
        const spriteOriginY = y * this.parameters.pieceSpriteSize;

        for (let spritePixelX = 0; spritePixelX < this.parameters.pieceSpriteSize; spritePixelX++) {
          for (let spritePixelY = 0; spritePixelY < this.parameters.pieceSpriteSize; spritePixelY++) {
            const spritesheetPixelX = spriteOriginX + spritePixelX;
            const spritesheetPixelY = spriteOriginY + spritePixelY;

            const pixelIndex = (spritesheetPixelX + spritesheetPixelY * spritesheetWidth) * bytePerPixel;
            alphaChannels[x][y][spritePixelX][spritePixelY] = spritesheetPixels[pixelIndex + alphaChannelOffset];
          }
        }
      }
    }

    return { image: spritesheetCanvas.transferToImageBitmap(), alphaChannels };
  }

}

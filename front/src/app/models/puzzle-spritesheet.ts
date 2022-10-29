import { BaseTexture, MIPMAP_MODES, MSAA_QUALITY, SCALE_MODES, Texture } from '@pixi/core';
import { Spritesheet } from '@pixi/spritesheet';
import { Canvas } from '../services/canvas';
import { Axis } from './geometry';
import { PieceShape } from './piece-shape';
import { StraightEdge } from './straight-edge';
import { TabbedEdge } from './tabbed-edge';
import type { Edge } from './edge';
import type { Point } from './geometry';
import type { ISpritesheetData } from '@pixi/spritesheet';

// Represent the top-left (included) and the bottom-right (excluded) coordinates of a quadrant.
// This is used to split the original spritesheet in 4 spritesheets
// when the puzzle's texture exceed the maximum texture size allowed by the device.
type Quadrant = {start: Point; end: Point};

export class PuzzleSpritesheet {

  public readonly width: number;
  public readonly height: number;
  public readonly pieceMargin: number;
  public readonly pieceSpriteSize: number;

  private readonly pieceStrokeColor = '#fff';
  private readonly pieceStrokeThickness = 1;
  private readonly textureSettings = {
    mipmap: MIPMAP_MODES.ON,
    scaleMode: SCALE_MODES.LINEAR,
    multisample: MSAA_QUALITY.HIGH,
    resolution: 1,
  };

  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly edgeMatrices: Record<Axis, Array<Array<Edge>>>;
  private readonly pieceShapeMatrix: Array<Array<PieceShape>>;
  private spritesheets: Array<Spritesheet> = [];

  constructor(
    private readonly image: ImageBitmap,
    private readonly imageOffset: Point = {x: 0, y: 0},
    public readonly pieceSize: number,
    public readonly horizontalPieceCount: number,
    public readonly verticalPieceCount: number,
  ) {
    this.pieceMargin = Math.ceil(PieceShape.MarginFactor * this.pieceSize) + this.pieceStrokeThickness;
    this.pieceSpriteSize = this.pieceSize + this.pieceMargin * 2;
    this.width = this.pieceSpriteSize * this.horizontalPieceCount;
    this.height = this.pieceSpriteSize * this.verticalPieceCount;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.context = Canvas.getContext2D(this.canvas);
    this.edgeMatrices = {
      [Axis.Horizontal]: this.buildEdgeMatrix(Axis.Horizontal),
      [Axis.Vertical]: this.buildEdgeMatrix(Axis.Vertical),
    };
    this.pieceShapeMatrix = this.buildPieceShapeMatrix();
    this.draw();
  }

  public async parse(maxTextureSize: number): Promise<{
    textures: Array<Array<Texture>>;
    alphaChannels: Array<Array<Array<Uint8ClampedArray>>>;
  }> {
    // Split the original spritesheet into 4 quadrants if needed
    let spritesheetQuadrants: Array<Quadrant> = [{
      start: {
        x: 0,
        y: 0,
      },
      end: {
        x: this.horizontalPieceCount,
        y: this.verticalPieceCount,
      },
    }];
    if (this.width > maxTextureSize) {
      spritesheetQuadrants = spritesheetQuadrants.flatMap((quadrant) => this.splitQuadrant(quadrant));
    }

    // If the quadrants are still to big for the device, throw an error
    const maxQuadrantWidth = spritesheetQuadrants[0].end.x * this.pieceSpriteSize;
    const maxQuadrantHeight = spritesheetQuadrants[0].end.x * this.pieceSpriteSize;
    if (maxQuadrantWidth > maxTextureSize || maxQuadrantHeight > maxTextureSize) {
      throw new Error('Device is too weak to render the puzzle spritesheet');
    }

    // Populate the alpha channels from the spritesheet
    const pieceAlphaChannels: Array<Array<Array<Uint8ClampedArray>>> = Array.from(Array(this.horizontalPieceCount), () => new Array(this.verticalPieceCount));
    this.populateSpritesheetAlphaChannels(pieceAlphaChannels);

    // Populate the textures from the different spritesheet quadrants
    const pieceTextures: Array<Array<Texture>> = Array.from(Array(this.horizontalPieceCount), () => Array(this.verticalPieceCount));
    await Promise.all(spritesheetQuadrants.map((quadrant) => this.populateSpritesheetTexturesFromQuadrant(pieceTextures, quadrant)));
    return {
      textures: pieceTextures,
      alphaChannels: pieceAlphaChannels,
    };
  }

  public destroy(): void {
    this.spritesheets.forEach((spritesheet) => {
      spritesheet.destroy(true);
    });
    this.spritesheets = [];
  }

  // public setScaleModeToNearest(): void {
  //   this.setScaleMode(SCALE_MODES.NEAREST);
  // }

  // public setScaleModeToLinear(): void {
  //   this.setScaleMode(SCALE_MODES.LINEAR);
  // }

  private setScaleMode(scaleMode: SCALE_MODES): void {
    this.spritesheets.forEach((spritesheet) => {
      if (spritesheet.baseTexture.scaleMode !== scaleMode) {
        spritesheet.baseTexture.scaleMode = scaleMode;
        spritesheet.baseTexture.update();
      }
    });
  }

  private populateSpritesheetAlphaChannels(alphaChannels: Array<Array<Array<Uint8ClampedArray>>>): void {
    const bytePerPixel = 4;
    const alphaChannelOffset = 3;
    const spritesheetWidth = this.canvas.width;
    const spriteWidth = this.pieceSpriteSize;
    const spriteHeight = this.pieceSpriteSize;
    const pixels = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height).data;
    for (let spriteX = 0; spriteX < this.horizontalPieceCount; spriteX++) {
      for (let spriteY = 0; spriteY < this.verticalPieceCount; spriteY++) {
        const alphaChannel = Array.from(Array(this.pieceSpriteSize), () => new Uint8ClampedArray(this.pieceSpriteSize));
        for (let spritePixelX = 0; spritePixelX < spriteWidth; spritePixelX++) {
          for (let spritePixelY = 0; spritePixelY < spriteHeight; spritePixelY++) {
            const spritesheetPixelX = spriteX * spriteWidth + spritePixelX;
            const spritesheetPixelY = spriteY * spriteHeight + spritePixelY;
            const pixelIndex = (spritesheetPixelX + spritesheetPixelY * spritesheetWidth) * bytePerPixel;
            alphaChannel[spritePixelX][spritePixelY] = pixels[pixelIndex + alphaChannelOffset];
          }
        }
        alphaChannels[spriteX][spriteY] = alphaChannel;
      }
    }
  }

  private async populateSpritesheetTexturesFromQuadrant(textures: Array<Array<Texture>>, quadrant: Quadrant): Promise<void> {
    const quandrantSpritesheet = await this.getSpritesheetFromQuadrant(quadrant);
    const quandantTextures = await quandrantSpritesheet.parse();
    for (let x = quadrant.start.x; x < quadrant.end.x; x++) {
      for (let y = quadrant.start.y; y < quadrant.end.y; y++) {
        const texture = quandantTextures[`${x}_${y}`];
        if (!texture) {
          throw new Error('Unable to retrieve piece texture');
        }
        textures[x][y] = texture;
      }
    }
  }

  private async getSpritesheetFromQuadrant(quadrant: Quadrant): Promise<Spritesheet> {
    const spritesheetImage = await this.getSpritesheetImageFromQuadrant(quadrant);
    const spritesheetTexture = new BaseTexture(spritesheetImage, this.textureSettings);
    const spritesheetData = this.getSpritesheetDataFromQuadrant(quadrant);
    const spritesheet = new Spritesheet(spritesheetTexture, spritesheetData);
    this.spritesheets.push(spritesheet);
    return spritesheet;
  }

  private getSpritesheetImageFromQuadrant(quadrant: Quadrant): Promise<ImageBitmap> {
    return createImageBitmap(
      this.canvas,
      quadrant.start.x * this.pieceSpriteSize,
      quadrant.start.y * this.pieceSpriteSize,
      (quadrant.end.x - quadrant.start.x) * this.pieceSpriteSize,
      (quadrant.end.y - quadrant.start.y) * this.pieceSpriteSize,
    );
  }

  private getSpritesheetDataFromQuadrant(quadrant: Quadrant): ISpritesheetData {
    const spritesheetData: ISpritesheetData = {
      frames: {},
      meta: {
        scale: '1',
      },
    };
    for (let x = quadrant.start.x; x < quadrant.end.x; x++) {
      for (let y = quadrant.start.y; y < quadrant.end.y; y++) {
        spritesheetData.frames[`${x}_${y}`] = {
          frame: {
            x: (x - quadrant.start.x) * this.pieceSpriteSize,
            y: (y - quadrant.start.y) * this.pieceSpriteSize,
            w: this.pieceSpriteSize,
            h: this.pieceSpriteSize,
          },
        };
      }
    }
    return spritesheetData;
  }

  private splitQuadrant(quadrant: Quadrant): Array<Quadrant> {
    // Split a quadrant into 4 new quadrants
    const quadrantSplitX = Math.ceil((quadrant.start.x + quadrant.end.x) / 2);
    const quadrantSplitY = Math.ceil((quadrant.start.y + quadrant.end.y) / 2);
    return [
      // Top left quadrant
      {
        start: {
          x: quadrant.start.x,
          y: quadrant.start.y,
        },
        end: {
          x: quadrantSplitX,
          y: quadrantSplitY,
        },
      },
      // Top right quadrant
      {
        start: {
          x: quadrantSplitX,
          y: quadrant.start.y,
        },
        end: {
          x: quadrant.end.x,
          y: quadrantSplitY,
        },
      },
      // Bottom left quadrant
      {
        start: {
          x: quadrant.start.x,
          y: quadrantSplitY,
        },
        end: {
          x: quadrantSplitX,
          y: quadrant.end.y,
        },
      },
      // Bottom right quadrant
      {
        start: {
          x: quadrantSplitX,
          y: quadrantSplitY,
        },
        end: {
          x: quadrant.end.x,
          y: quadrant.end.y,
        },
      },
    ];
  }

  private buildEdgeMatrix(edgeAxis: Axis): Array<Array<Edge>> {
    // There is one more edge when adding them along their opposite axis
    // e.g. when edges are verticals, if there is 10 pieces, then there is 11 vertical edges along the horizontal axis
    const edgeCountX = this.horizontalPieceCount + (edgeAxis === Axis.Vertical ? 1 : 0);
    const edgeCountY = this.verticalPieceCount + (edgeAxis === Axis.Horizontal ? 1 : 0);
    const edgeMatrice = [];
    for (let x = 0; x < edgeCountX; x++) {
      const edgeList = [];
      for (let y = 0; y < edgeCountY; y++) {
        if (
          edgeAxis === Axis.Vertical && (x === 0 || x === this.horizontalPieceCount)
          ||
          edgeAxis === Axis.Horizontal && (y === 0 || y === this.verticalPieceCount)
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

  private buildPieceShapeMatrix(): Array<Array<PieceShape>> {
    const pieceShapeMatrix = [];
    for (let x = 0; x < this.horizontalPieceCount; x++) {
      const pieceShapeList = [];
      for (let y = 0; y < this.verticalPieceCount; y++) {
        pieceShapeList.push(new PieceShape(
          x * this.pieceSize,
          y * this.pieceSize,
          this.pieceSize,
          this.edgeMatrices.horizontal[x][y],
          this.edgeMatrices.vertical[x+1][y],
          this.edgeMatrices.horizontal[x][y+1],
          this.edgeMatrices.vertical[x][y],
        ));
      }
      pieceShapeMatrix.push(pieceShapeList);
    }
    return pieceShapeMatrix;
  }

  private draw(): void {
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (let x = 0; x < this.horizontalPieceCount; x++) {
      for (let y = 0; y < this.verticalPieceCount; y++) {
        const pieceShape = this.pieceShapeMatrix[x][y];

        // Translate to new sprite position
        this.context.save();
        this.context.translate(
          this.pieceSpriteSize * x + this.pieceMargin,
          this.pieceSpriteSize * y + this.pieceMargin,
        );

        // Draw piece image
        this.context.save();
        this.context.clip(pieceShape.path);
        this.context.drawImage(
          this.image,
          -this.pieceMargin + pieceShape.x + this.imageOffset.x,
          -this.pieceMargin + pieceShape.y + this.imageOffset.y,
          this.pieceSpriteSize,
          this.pieceSpriteSize,
          -this.pieceMargin,
          -this.pieceMargin,
          this.pieceSpriteSize,
          this.pieceSpriteSize,
        );
        this.context.restore();

        // Draw piece stroke
        this.context.save();
        this.context.strokeStyle = this.pieceStrokeColor;
        this.context.lineWidth = this.pieceStrokeThickness;
        this.context.stroke(pieceShape.path);
        this.context.restore();

        // Restore position
        this.context.restore();
      }
    }
  }

}

import type { Point } from '../../models/geometry';
import type { PuzzleGameParameters } from '../../models/puzzle-game-parameters';
import type { ElementRef } from '@angular/core';

import { ChangeDetectionStrategy, Component, computed, effect, input, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Axis, VALID_AXES } from '../../models/geometry';
import { TabbedEdge } from '../../models/tabbed-edge';
import { Canvas } from '../../utils/canvas';

@Component({
  selector: 'app-puzzle-preview',
  templateUrl: './puzzle-preview.component.html',
  styleUrl: './puzzle-preview.component.scss',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PuzzlePreviewComponent {

  private readonly defaultPreviewMaxWidth = 2152;
  private readonly pieceStrokeThickness = 2;
  private readonly pieceStrokeLightColor = '#fff';
  private readonly pieceStrokeShadowColor = '#000';
  private readonly puzzleOverflowFillColor = '#fffc';

  private readonly puzzleImageRef = viewChild.required<ElementRef<HTMLCanvasElement>>('puzzleImage');
  private readonly puzzleCutoutsRef = viewChild.required<ElementRef<HTMLCanvasElement>>('puzzleCutouts');
  private readonly puzzleImageContext = computed(() => this.puzzleImageRef().nativeElement.getContext('2d'));
  private readonly puzzleCutoutsContext = computed(() => this.puzzleCutoutsRef().nativeElement.getContext('2d'));

  public readonly puzzleImage = input.required<ImageBitmap | null>();
  public readonly puzzleOffset = input.required<Point>();
  public readonly pieceSize = input.required<number>();
  public readonly horizontalPieceCount = input.required<number>();
  public readonly verticalPieceCount = input.required<number>();
  public readonly loading = input.required<boolean>();

  // Scale down the preview to match UI canvas size as we don't need the full resolution here
  private readonly previewScale = computed<number>(() => {
    const puzzleImage = this.puzzleImage();
    if (!puzzleImage) {
      return 1;
    }
    const puzzleImageCanvas = this.puzzleImageRef().nativeElement;
    const pixelDensity = Math.min(Math.max(window.devicePixelRatio, 1), 2);
    const puzzlePreviewWidth = Math.min(this.defaultPreviewMaxWidth, puzzleImageCanvas.clientWidth * pixelDensity);
    return puzzleImage.width > puzzlePreviewWidth ? puzzlePreviewWidth / puzzleImage.width : 1;
  });

  private readonly horizontalPatternCanvas = new OffscreenCanvas(0, 0);
  private readonly verticalPatternCanvas = new OffscreenCanvas(0, 0);
  private readonly middlePatternCanvas = new OffscreenCanvas(0, 0);
  private readonly horizontalPatternContext = Canvas.getOffscreenContext2D(this.horizontalPatternCanvas);
  private readonly verticalPatternContext = Canvas.getOffscreenContext2D(this.verticalPatternCanvas);
  private readonly middlePatternContext = Canvas.getOffscreenContext2D(this.middlePatternCanvas);

  private renderingPreview = false;

  // The rendering must be synchronous,
  // so that cancelling a new puzzle image loading and immediatly loading another one
  // will guarantee that that the first one will not render after the second one
  constructor() {
    // Draw puzzle image on its own canvas to prevent unecessary redraw
    effect(() => {
      const puzzleImage = this.puzzleImage();
      const puzzleImageCanvas = this.puzzleImageRef().nativeElement;
      const puzzleImageContext = this.puzzleImageContext();
      const previewScale = this.previewScale();
      if (!puzzleImage || !puzzleImageContext) {
        return;
      }
      untracked(() => {
        this.drawPuzzleImage(puzzleImageCanvas, puzzleImageContext, puzzleImage, previewScale);
      });
    });

    // Draw puzzle cutouts on their own canvas for better performance
    effect(() => {
      const puzzleImage = this.puzzleImage();
      const horizontalPieceCount = this.horizontalPieceCount();
      const verticalPieceCount = this.verticalPieceCount();
      const puzzleCutoutsCanvas = this.puzzleCutoutsRef().nativeElement;
      const puzzleCutoutsContext = this.puzzleCutoutsContext();
      const previewScale = this.previewScale();
      const puzzleOffset = this.puzzleOffset();
      const pieceSize = this.pieceSize();
      if (!puzzleImage || !puzzleCutoutsContext) {
        return;
      }
      untracked(() => {
        this.updatePuzzleCutouts(
          puzzleCutoutsCanvas,
          puzzleCutoutsContext,
          {
            puzzleImage,
            puzzleOffset: {
              x: Math.round(puzzleOffset.x * previewScale),
              y: Math.round(puzzleOffset.y * previewScale),
            },
            pieceSize: Math.round(pieceSize * previewScale),
            horizontalPieceCount,
            verticalPieceCount,
          },
        );
      });
    });
  }

  private drawPuzzleImage(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D, image: ImageBitmap, scale: number): void {
    const resizeWidth = Math.round(image.width * scale);
    const resizeHeight = Math.round(image.height * scale);
    canvas.width = resizeWidth;
    canvas.height = resizeHeight;
    context.reset();
    context.drawImage(image, 0, 0, image.width, image.height, 0, 0, resizeWidth, resizeHeight);
  }

  private updatePuzzleCutouts(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D, parameters: PuzzleGameParameters): void {
    // Throttle the rendering so that we are not rendering it too often
    // (the user may change the puzzle size faster than the canvas is able to render it during one frame)
    if (this.renderingPreview) {
      return;
    }
    this.renderingPreview = true;
    window.requestAnimationFrame(() => {
      this.renderingPreview = false;
      this.drawPuzzlePatterns(parameters);
      this.drawPuzzleCutouts(canvas, context, parameters);
    });
  }

  private drawPuzzleCutouts(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D, parameters: PuzzleGameParameters): void {
    const patterns = this.getPatterns(parameters);

    // Don't use the parameters.puzzleImage to avoid rounding issues
    const puzzlePreviewWidth = parameters.pieceSize * parameters.horizontalPieceCount;
    const puzzlePreviewHeight = parameters.pieceSize * parameters.verticalPieceCount;
    const puzzleWidth = puzzlePreviewWidth + parameters.puzzleOffset.x * 2;
    const puzzleHeight = puzzlePreviewHeight + parameters.puzzleOffset.y * 2;

    // Reset canvas
    context.reset();
    canvas.width = puzzleWidth;
    canvas.height = puzzleHeight;

    // Draw overflow overlay
    context.save();
    context.fillStyle = this.puzzleOverflowFillColor;
    context.fillRect(0, 0, parameters.puzzleOffset.x, puzzleHeight);
    context.fillRect(parameters.puzzleOffset.x, 0, puzzlePreviewWidth, parameters.puzzleOffset.y);
    context.fillRect(puzzleWidth - parameters.puzzleOffset.x, 0, parameters.puzzleOffset.x, puzzleHeight);
    context.fillRect(parameters.puzzleOffset.x, puzzleHeight - parameters.puzzleOffset.y, puzzlePreviewWidth, parameters.puzzleOffset.y);
    context.restore();

    // Draw shadow outline
    const halfStrokeThickness = this.pieceStrokeThickness / 2;
    const halfStrokeThicknessFloor = Math.floor(halfStrokeThickness);
    const halfStrokeThicknessCeil = Math.ceil(halfStrokeThickness);
    context.save();
    context.lineWidth = halfStrokeThicknessCeil;
    context.strokeStyle = this.pieceStrokeShadowColor;
    context.strokeRect(
      parameters.puzzleOffset.x,
      parameters.puzzleOffset.y,
      puzzlePreviewWidth - halfStrokeThicknessFloor,
      puzzlePreviewHeight - halfStrokeThicknessFloor,
    );
    context.restore();

    // Draw middle section of the puzzle cutouts
    const middle = Math.round(parameters.pieceSize / 2);
    context.save();
    context.fillStyle = patterns.middle;
    context.fillRect(
      parameters.puzzleOffset.x + middle,
      parameters.puzzleOffset.y + middle,
      parameters.pieceSize * (parameters.horizontalPieceCount - 1),
      parameters.pieceSize * (parameters.verticalPieceCount - 1),
    );
    // Draw top section of the puzzle cutouts
    context.fillStyle = patterns.vertical;
    context.fillRect(
      parameters.puzzleOffset.x + middle,
      parameters.puzzleOffset.y,
      parameters.pieceSize * (parameters.horizontalPieceCount - 1),
      middle,
    );
    // Draw bottom section of the puzzle cutouts
    context.fillRect(
      parameters.puzzleOffset.x + middle,
      parameters.puzzleOffset.y + middle + parameters.pieceSize * (parameters.verticalPieceCount - 1),
      parameters.pieceSize * (parameters.horizontalPieceCount - 1),
      middle,
    );
    // Draw left section of the puzzle cutouts
    context.fillStyle = patterns.horizontal;
    context.fillRect(
      parameters.puzzleOffset.x,
      parameters.puzzleOffset.y + middle,
      middle,
      parameters.pieceSize * (parameters.verticalPieceCount - 1),
    );
    // Draw right section of the puzzle cutouts
    context.fillRect(
      parameters.puzzleOffset.x + middle + parameters.pieceSize * (parameters.horizontalPieceCount - 1),
      parameters.puzzleOffset.y + middle,
      middle,
      parameters.pieceSize * (parameters.verticalPieceCount - 1),
    );
    context.restore();

    // Draw light outline
    context.save();
    context.lineWidth = halfStrokeThicknessCeil;
    context.strokeStyle = this.pieceStrokeShadowColor;
    context.beginPath();
    context.moveTo(parameters.puzzleOffset.x + puzzlePreviewWidth - halfStrokeThicknessCeil, parameters.puzzleOffset.y);
    context.lineTo(parameters.puzzleOffset.x, parameters.puzzleOffset.y);
    context.lineTo(parameters.puzzleOffset.x, parameters.puzzleOffset.y + puzzlePreviewHeight - halfStrokeThicknessCeil);
    context.stroke();
    context.strokeStyle = this.pieceStrokeLightColor;
    context.strokeRect(
      parameters.puzzleOffset.x + halfStrokeThicknessCeil,
      parameters.puzzleOffset.y + halfStrokeThicknessCeil,
      puzzlePreviewWidth - halfStrokeThicknessFloor,
      puzzlePreviewHeight - halfStrokeThicknessFloor,
    );
    context.restore();
  }

  private drawPuzzlePatterns(parameters: PuzzleGameParameters): void {
    // Reset pattern canvases
    this.horizontalPatternContext.reset();
    this.horizontalPatternCanvas.width = parameters.pieceSize;
    this.horizontalPatternCanvas.height = parameters.pieceSize;
    this.verticalPatternContext.reset();
    this.verticalPatternCanvas.width = parameters.pieceSize;
    this.verticalPatternCanvas.height = parameters.pieceSize;
    this.middlePatternContext.reset();
    this.middlePatternCanvas.width = parameters.pieceSize;
    this.middlePatternCanvas.height = parameters.pieceSize;

    const middle = Math.round(parameters.pieceSize / 2);
    const edges: Record<Axis, TabbedEdge> = {
      [Axis.Horizontal]: new TabbedEdge(Axis.Horizontal, false),
      [Axis.Vertical]: new TabbedEdge(Axis.Vertical, false),
    };
    const middleOffsets: Record<Axis, Point> = {
      [Axis.Horizontal]: {
        x: parameters.pieceSize,
        y: 0,
      },
      [Axis.Vertical]: {
        x: 0,
        y: parameters.pieceSize,
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
          edge.appendTo(middleContext, horizontalOffset, verticalOffset, parameters.pieceSize, false);
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
          edge.appendTo(context, horizontalOffset, verticalOffset, parameters.pieceSize, false);
          context.stroke();
        }
        context.restore();
      }
      context.restore();
    }
  }

  private getPatterns(parameters: PuzzleGameParameters): Record<'horizontal' | 'vertical' | 'middle', CanvasPattern> {
    const middle = Math.round(parameters.pieceSize / 2);

    // Horizontal pattern
    const horizontalPatternMatrix = new DOMMatrix().translate(
      parameters.puzzleOffset.x + middle,
      parameters.puzzleOffset.y + middle,
    );
    const horizontalPattern = Canvas.createPattern(this.horizontalPatternContext, this.horizontalPatternCanvas);
    horizontalPattern.setTransform(horizontalPatternMatrix);

    // Vertical pattern
    const verticalPatternMatrix = new DOMMatrix().translate(
      parameters.puzzleOffset.x + middle,
      parameters.puzzleOffset.y + middle,
    );
    const verticalPattern = Canvas.createPattern(this.verticalPatternContext, this.verticalPatternCanvas);
    verticalPattern.setTransform(verticalPatternMatrix);

    // Middle pattern
    const middlePatternMatrix = new DOMMatrix().translate(
      parameters.puzzleOffset.x + middle,
      parameters.puzzleOffset.y + middle,
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

import type { Point } from '../../models/geometry';

import { ChangeDetectionStrategy, Component, computed, effect, inject, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { AXIS_TO_DIMENSION, VALID_AXES } from '../../models/geometry';
import { CurrentPuzzleGameService } from '../../services/current-puzzle-parameters.service';
import { PuzzlePreviewComponent } from '../puzzle-preview/puzzle-preview.component';
import { PuzzleSelectFieldComponent } from '../puzzle-select-field/puzzle-select-field.component';

@Component({
  selector: 'app-puzzle-form',
  templateUrl: './puzzle-form.component.html',
  styleUrl: './puzzle-form.component.scss',
  imports: [FormsModule, PuzzlePreviewComponent, PuzzleSelectFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PuzzleFormComponent {

  private readonly router = inject(Router);
  private readonly currentPuzzleGameService = inject(CurrentPuzzleGameService);

  public readonly isLoading = signal<boolean>(false);
  public readonly puzzleImage = signal<ImageBitmap | null>(null);
  public readonly selectedPieceSizeIndex = model<number>(1);
  public readonly validPieceSizes = signal<number[]>([50, 100, 200, 400, 500]);
  public readonly puzzleOffset = signal<Point>({ x: 0, y: 0 });
  public readonly horizontalPieceCount = signal<number>(10);
  public readonly verticalPieceCount = signal<number>(10);

  public readonly pieceSize = computed<number>(() => {
    return this.validPieceSizes()[this.selectedPieceSizeIndex()];
  });

  private readonly minPieceCountPerAxis = 4; // 12 pieces
  private readonly maxPieceCountPerAxis = 50; // 2500 pieces
  private readonly minPieceSizeConstraint = 60; // In pixels
  private readonly maxPieceSizeConstraint = 600; // In pixels

  constructor() {
    effect(() => {
      this.updateValidPieceSizes();
    });
    effect(() => {
      this.updatePuzzleSize();
    });
  }

  public async startPuzzle(): Promise<void> {
    const puzzleImage = this.puzzleImage();
    if (!puzzleImage) {
      return;
    }

    this.currentPuzzleGameService.setParameters({
      puzzleImage,
      puzzleOffset: this.puzzleOffset(),
      pieceSize: this.pieceSize(),
      horizontalPieceCount: this.horizontalPieceCount(),
      verticalPieceCount: this.verticalPieceCount(),
    });
    await this.router.navigate(['/play']);
  }

  private updateValidPieceSizes(): void {
    const puzzleImage = this.puzzleImage();
    if (!puzzleImage) {
      return;
    }
    const minPieceSize = Math.max(
      Math.floor(puzzleImage.width / this.maxPieceCountPerAxis),
      Math.floor(puzzleImage.height / this.maxPieceCountPerAxis),
      this.minPieceSizeConstraint,
    );
    const maxPieceSize = Math.min(
      Math.floor(puzzleImage.width / this.minPieceCountPerAxis),
      Math.floor(puzzleImage.height / this.minPieceCountPerAxis),
      this.maxPieceSizeConstraint,
    );

    const validPieceSizes = [];
    for (const axis of VALID_AXES) {
      const puzzleDimension = puzzleImage[AXIS_TO_DIMENSION[axis]];
      const minPieceCount = Math.floor(puzzleDimension / maxPieceSize);
      const maxPieceCount = Math.floor(puzzleDimension / minPieceSize);
      for (let pieceCount = minPieceCount; pieceCount <= maxPieceCount; pieceCount++) {
        const pieceSize = Math.max(minPieceSize, Math.min(maxPieceSize, Math.floor(puzzleDimension / pieceCount)));
        const pieceSizeIndex = validPieceSizes.findIndex((validPieceSize) => validPieceSize <= pieceSize);
        // Add values in descending order (from the biggest piece to the smallest piece)
        // So the range input is going from the smallest to the biggest number of pieces
        if (pieceSizeIndex === -1) {
          validPieceSizes.push(pieceSize);
        }
        else if (validPieceSizes[pieceSizeIndex] !== pieceSize) {
          validPieceSizes.splice(pieceSizeIndex, 0, pieceSize);
        }
      }
    }

    this.validPieceSizes.set(validPieceSizes);
    this.selectedPieceSizeIndex.set(Math.floor(this.validPieceSizes().length / 4));
  }

  private updatePuzzleSize(): void {
    const puzzleImage = this.puzzleImage();
    const pieceSize = this.pieceSize();
    if (!puzzleImage) {
      return;
    }
    const horizontalPieceCount = Math.floor(puzzleImage.width / pieceSize);
    const verticalPieceCount = Math.floor(puzzleImage.height / pieceSize);
    const puzzleWidth = horizontalPieceCount * pieceSize;
    const puzzleHeight = verticalPieceCount * pieceSize;

    this.horizontalPieceCount.set(horizontalPieceCount);
    this.verticalPieceCount.set(verticalPieceCount);
    this.puzzleOffset.set({
      x: Math.floor((puzzleImage.width - puzzleWidth) / 2),
      y: Math.floor((puzzleImage.height - puzzleHeight) / 2),
    });
  }

}

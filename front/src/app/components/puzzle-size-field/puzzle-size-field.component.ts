import type { PuzzleSizeParameters } from '../../models/puzzle-parameters';

import { ChangeDetectionStrategy, Component, effect, input, model, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AXIS_TO_DIMENSION, VALID_AXES } from '../../models/geometry';

@Component({
  selector: 'app-puzzle-size-field',
  templateUrl: './puzzle-size-field.component.html',
  styleUrl: './puzzle-size-field.component.scss',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PuzzleSizeFieldComponent {

  private readonly minPieceCountPerAxis = 4; // 12 pieces
  private readonly maxPieceCountPerAxis = 50; // 2500 pieces
  private readonly minPieceSizeConstraint = 60; // In pixels
  private readonly maxPieceSizeConstraint = 600; // In pixels

  public readonly puzzleImage = input.required<ImageBitmap | null>();
  public readonly loading = input.required<boolean>();
  public readonly puzzleSizeParameters = model.required<PuzzleSizeParameters | null>();

  protected readonly selectedPieceSizeIndex = signal<number>(0);
  protected readonly validPieceSizes = signal<number[]>([this.minPieceSizeConstraint, this.maxPieceSizeConstraint]);

  private tryRestoringPreviousPieceSize = true;

  constructor() {
    effect(() => {
      const puzzleImage = this.puzzleImage();
      if (!puzzleImage) {
        return;
      }
      this.updateValidPieceSizes(puzzleImage);
    });

    effect(() => {
      const validPieceSizes = this.validPieceSizes();
      untracked(() => {
        const previousPieceSize = this.puzzleSizeParameters()?.pieceSize;
        this.updateSelectedPieceSizeIndex(validPieceSizes, previousPieceSize);
      });
    });

    effect(() => {
      const puzzleImage = this.puzzleImage();
      const validPieceSizes = this.validPieceSizes();
      const selectedPieceSizeIndex = this.selectedPieceSizeIndex();
      const pieceSize = validPieceSizes[selectedPieceSizeIndex];
      if (!puzzleImage || !pieceSize) {
        return;
      }
      this.updatePuzzleSizeParameters(puzzleImage, pieceSize);
    });
  }

  private updateValidPieceSizes(puzzleImage: ImageBitmap): void {
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
  }

  private updateSelectedPieceSizeIndex(validPieceSizes: number[], previousPieceSize?: number): void {
    const previousPieceSizeIndex = validPieceSizes.findIndex((pieceSize) => pieceSize === previousPieceSize);
    const defaultPieceSizeIndex = Math.floor(validPieceSizes.length / 4);

    // If the user comes from a previous game, we try to restore what piece size they had chosen
    if (this.tryRestoringPreviousPieceSize) {
      this.tryRestoringPreviousPieceSize = false;
      this.selectedPieceSizeIndex.set(previousPieceSizeIndex === -1 ? defaultPieceSizeIndex : previousPieceSizeIndex);
    }
    else {
      this.selectedPieceSizeIndex.set(defaultPieceSizeIndex);
    }
  }

  private updatePuzzleSizeParameters(puzzleImage: ImageBitmap, pieceSize: number): void {
    const horizontalPieceCount = Math.floor(puzzleImage.width / pieceSize);
    const verticalPieceCount = Math.floor(puzzleImage.height / pieceSize);
    const puzzleWidth = horizontalPieceCount * pieceSize;
    const puzzleHeight = verticalPieceCount * pieceSize;
    const puzzleOffset = {
      x: Math.floor((puzzleImage.width - puzzleWidth) / 2),
      y: Math.floor((puzzleImage.height - puzzleHeight) / 2),
    };

    this.puzzleSizeParameters.set({
      puzzleOffset,
      pieceSize,
      horizontalPieceCount,
      verticalPieceCount,
    });
  }

}

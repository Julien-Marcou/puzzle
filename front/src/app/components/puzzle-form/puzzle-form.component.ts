import type { PuzzleSizeParameters } from '../../models/puzzle-parameters';

import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { CurrentPuzzleGameService } from '../../services/current-puzzle-parameters.service';
import { PuzzlePreviewComponent } from '../puzzle-preview/puzzle-preview.component';
import { PuzzleSelectFieldComponent } from '../puzzle-select-field/puzzle-select-field.component';
import { PuzzleSizeFieldComponent } from '../puzzle-size-field/puzzle-size-field.component';

@Component({
  selector: 'app-puzzle-form',
  templateUrl: './puzzle-form.component.html',
  styleUrl: './puzzle-form.component.scss',
  imports: [FormsModule, PuzzlePreviewComponent, PuzzleSelectFieldComponent, PuzzleSizeFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PuzzleFormComponent {

  private readonly router = inject(Router);
  private readonly currentPuzzleGameService = inject(CurrentPuzzleGameService);

  protected readonly isLoading = signal<boolean>(false);
  protected readonly puzzleId = signal<string | null>(null);
  protected readonly puzzleImage = signal<ImageBitmap | null>(null);
  protected readonly puzzleSizeParameters = signal<PuzzleSizeParameters | null>(null);

  constructor() {
    this.restorePreviousPuzzle();
  }

  protected async startPuzzle(): Promise<void> {
    const puzzleId = this.puzzleId();
    const puzzleImage = this.puzzleImage();
    const puzzleSizeParameters = this.puzzleSizeParameters();
    if (!puzzleId || !puzzleImage || !puzzleSizeParameters) {
      return;
    }
    this.currentPuzzleGameService.setId(puzzleId);
    this.currentPuzzleGameService.setParameters(puzzleImage, puzzleSizeParameters);
    await this.router.navigate(['/play']);
  }

  private restorePreviousPuzzle(): void {
    const puzzleId = this.currentPuzzleGameService.getId();
    const puzzleGameParameters = this.currentPuzzleGameService.getParameters();
    if (puzzleId && puzzleGameParameters) {
      const { puzzleImage, ...puzzleSizeParameters } = puzzleGameParameters;
      this.puzzleId.set(puzzleId);
      this.puzzleImage.set(puzzleImage);
      this.puzzleSizeParameters.set(puzzleSizeParameters);
    }
  }

}

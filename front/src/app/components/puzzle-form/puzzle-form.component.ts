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
  protected readonly puzzleImage = signal<ImageBitmap | null>(null);
  protected readonly puzzleSizeParameters = signal<PuzzleSizeParameters | null>(null);

  protected async startPuzzle(): Promise<void> {
    const puzzleImage = this.puzzleImage();
    const puzzleSizeParameters = this.puzzleSizeParameters();
    if (!puzzleImage || !puzzleSizeParameters) {
      return;
    }
    this.currentPuzzleGameService.setParameters(puzzleImage, puzzleSizeParameters);
    await this.router.navigate(['/play']);
  }

}
